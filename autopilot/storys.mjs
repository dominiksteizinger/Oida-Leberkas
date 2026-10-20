// Instagram-Storys für Resi (seit 20.10.2026). Standbilder 1080x1920, gratis, ohne Claude-API.
//   node storys.mjs bauen [datum] [mittag|abend] [karten-id]  (ohne Slot: nach Wiener Uhrzeit)
//     baut tagebuch/storys/<datum>-<slot>/story.jpg, mit JINGLE=an zusätzlich story.mp4 (GITHUB_OUTPUT: gebaut, id, art, rest)
//   node storys.mjs posten <datum>-<slot>                       veröffentlicht die Story und trägt sie in story-log.json ein
//   node storys.mjs pruefen                                      prüft storys.json und zeigt den Vorrat
//   node storys.mjs vorschau <ordner> [datum] [karten-id …]      rendert Karten als Bild, ohne Log und ohne Posten
// Mittag: Karte aus storys.json (Anlass zuerst, an auffälligen Wettertagen die Wetter-Story). Abend: Hinweis auf den Post von 16 Uhr.
// Per API gehen keine Sticker (Umfrage, Frage, Link, Musik); die Umfrage gibt es nur als Optik im Bild.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { pruefeWortfilter } from "./wortfilter.mjs";
import { Vorrat, slotFuer, pruefeVorrat, offeneKarten, waehleMittag, waehleHinweis, waehleBild, brauchtBild } from "./storyplan.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const WURZEL = path.join(HIER, "..");
const STORYS = path.join(WURZEL, "tagebuch", "storys");
const LOG = path.join(HIER, "story-log.json");
const lies = (p, std) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : std);
const bibliothek = lies(path.join(HIER, "bibliothek.json"), []);
const nutzung = lies(path.join(HIER, "nutzung.json"), []);
const log = lies(LOG, []);
const roh = lies(path.join(HIER, "storys.json"), null);
const ausgabe = (zeilen) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, zeilen);
const chrome = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/opt/pw-browsers/chromium"].find((p) => fs.existsSync(p));
const schrift = (f) => `file://${path.join(WURZEL, "assets", "fonts", f)}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function wetterHeute(datum) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=48.21&longitude=16.37&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe%2FVienna&start_date=${datum}&end_date=${datum}`;
    const d = (await (await fetch(url)).json()).daily;
    return { code: d.weather_code[0], max: d.temperature_2m_max[0], min: d.temperature_2m_min[0] };
  } catch (e) {
    console.log(`Wetter nicht geladen: ${e.message}`);
    return null;
  }
}

// Karte über render.mjs rendern (gleiche Formate und Reel-Anordnung wie die Posts) und zum Standbild zusammensetzen:
// Foto als Vollbild am Gesicht ausgeschnitten, Karte aus dem letzten Reel-Schritt darüber.
function karteRendern(ordner, id, inhalt, bild) {
  fs.mkdirSync(ordner, { recursive: true });
  fs.writeFileSync(path.join(ordner, "eintrag.json"), JSON.stringify({ id, datum: id.slice(0, 10), slot: "12", inhalt, ...(bild ? { bild } : {}) }, null, 2) + "\n");
  execFileSync("node", [path.join(HIER, "render.mjs"), path.relative(path.join(WURZEL, "tagebuch"), ordner)], { stdio: "inherit", env: { ...process.env, CHROME_PATH: chrome, KEIN_TAGEBUCH: "1" } });
  const { modus, schritte } = JSON.parse(fs.readFileSync(path.join(ordner, "schritte.json"), "utf8"));
  const karte = path.join(ordner, schritte.at(-1).datei);
  const info = bibliothek.find((b) => b.datei === bild) || {};
  const quelle = bild && path.join(HIER, "bilder", bild);
  const ziel = path.join(ordner, "story.jpg");
  const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args, "-frames:v", "1", "-q:v", "3", ziel], { stdio: "inherit" });
  if (modus === "foto" && quelle) {
    // wie video.mjs, ohne Zoom: 9:16-Ausschnitt möglichst mittig, das Gesicht mit Abstand zum Rand
    const kx = info.kopf ? info.kopf[0] : 0.5;
    const mitte = Math.min(Math.max(info.mitte ?? 0.5, kx - 0.22), kx + 0.22);
    ff(["-i", quelle, "-i", karte, "-filter_complex", `[0:v]crop=w='trunc(ih*9/32)*2':h=ih:x='min(max(${mitte.toFixed(3)}*iw-ih*9/32,0),iw-ih*9/16)':y=0,scale=1080:1920,setsar=1[hg];[hg][1:v]overlay=0:0`]);
  } else if (modus === "breit" && quelle) {
    ff(["-i", quelle, "-i", karte, "-filter_complex", "[0:v]split[b1][b2];[b1]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:2,eq=brightness=-0.18[bb];[b2]scale=1080:-2[bs];[bb][bs]overlay=0:(H-h)/2[hg];[hg][1:v]overlay=0:0"]);
  } else {
    ff(["-i", karte]);
  }
  for (const f of fs.readdirSync(ordner)) if (!["story.jpg", "eintrag.json"].includes(f)) fs.rmSync(path.join(ordner, f));
  return ziel;
}

// Abend: der frische Post (nur das Setup) im Rahmen, darunter eine Resi-Zeile. Hintergrund ist das Bild des Posts, unscharf und dunkel.
async function hinweisRendern(ordner, post, zeile) {
  fs.mkdirSync(ordner, { recursive: true });
  const e = JSON.parse(fs.readFileSync(path.join(post, "eintrag.json"), "utf8"));
  // Nur das Setup (post-a.jpg) zeigen, die Pointe gibt es im Profil
  const teaser = path.join(post, fs.existsSync(path.join(post, "post-a.jpg")) ? "post-a.jpg" : "post.jpg");
  const grund = e.bild ? `<img class="bg" src="file://${path.join(HIER, "bilder", e.bild)}">` : "";
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:I;font-weight:700;src:url(${schrift("Inter-Bold.otf")})}@font-face{font-family:I;font-weight:800;src:url(${schrift("Inter-ExtraBold.otf")})}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#120A10;font-family:I,sans-serif}
.bg{position:absolute;inset:-60px;width:1200px;height:2040px;object-fit:cover;filter:blur(36px) brightness(.45)}
.lab{position:absolute;top:300px;left:0;right:0;text-align:center}.lab span{font:800 34px I;letter-spacing:.14em;color:#120A10;background:#FF4FA3;padding:12px 26px;border-radius:12px}
.post{position:absolute;top:400px;left:130px;width:820px;border-radius:26px;box-shadow:0 24px 70px rgba(0,0,0,.65)}
.z{position:absolute;top:1470px;left:110px;right:110px;text-align:center;font:700 46px/1.25 I;color:#fff;text-wrap:balance}
</style></head><body>${grund}<div class="lab"><span>NEUER POST</span></div><img class="post" src="file://${teaser}"><div class="z">${esc(zeile)}</div></body></html>`;
  const tmp = path.join(ordner, "hinweis.html");
  fs.writeFileSync(tmp, html);
  const browser = await chromium.launch({ executablePath: chrome, args: ["--allow-file-access-from-files"] });
  const seite = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await seite.goto(`file://${tmp}`);
  await seite.evaluate(() => document.fonts.ready);
  await seite.waitForFunction(() => [...document.images].every((b) => b.complete && b.naturalWidth > 0));
  await seite.screenshot({ path: path.join(ordner, "story.jpg"), type: "jpeg", quality: 88 });
  await browser.close();
  fs.rmSync(tmp);
  fs.writeFileSync(path.join(ordner, "eintrag.json"), JSON.stringify({ id: path.basename(ordner), art: "hinweis", post: path.basename(post), zeile }, null, 2) + "\n");
}

// Mit JINGLE="an" (wie bei den Reels, Dominik 20.10.2026) wird die Story ein kurzes Video: Standbild plus Jingle,
// mindestens 5 s (Instagram zeigt Bild-Storys 5 s), sonst so lang wie der Jingle plus Nachlauf. Ohne Jingle bleibt es ein Bild.
const JINGLE_DATEI = path.join(HIER, "assets", "jingle.mp3");
function mitJingle(ordner) {
  if (process.env.JINGLE !== "an" || !fs.existsSync(JINGLE_DATEI)) return false;
  const laenge = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", JINGLE_DATEI], { encoding: "utf8" }));
  const dauer = Math.max(5, Math.ceil(laenge + 1.5)).toFixed(1);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-loop", "1", "-framerate", "30", "-t", dauer, "-i", path.join(ordner, "story.jpg"), "-i", JINGLE_DATEI,
    "-filter_complex", "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,adelay=300:all=1,apad[a]", "-map", "0:v", "-map", "[a]", "-t", dauer,
    "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-movflags", "+faststart",
    path.join(ordner, "story.mp4")], { stdio: "inherit" });
  console.log(`Story als Video mit Jingle (${dauer} s)`);
  return true;
}

function vorratLesen() {
  const fehler = pruefeVorrat(roh, bibliothek);
  if (fehler.length) throw new Error(`storys.json fehlerhaft:\n${fehler.join("\n")}`);
  return Vorrat.parse(roh);
}

async function bauen(datum, slot, kartenId) {
  const id = `${datum}-${slot}`;
  const ordner = path.join(STORYS, id);
  const vorrat = vorratLesen();
  const nichts = (grund) => { console.log(`Keine Story ${id}: ${grund}`); ausgabe("gebaut=false\n"); };
  if (log.some((x) => x.id === id) && !kartenId) return nichts("schon gepostet");
  fs.rmSync(ordner, { recursive: true, force: true });
  if (slot === "abend") {
    const post = path.join(WURZEL, "tagebuch", `${datum}-16`);
    if (!fs.existsSync(path.join(post, "post.jpg"))) return nichts("Post von 16 Uhr gibt es noch nicht");
    if (process.env.LIVE === "true" && !fs.existsSync(path.join(post, "gepostet.txt"))) return nichts("Post von 16 Uhr ist noch nicht gepostet");
    const n = waehleHinweis(vorrat.hinweise, log);
    await hinweisRendern(ordner, post, vorrat.hinweise[n]);
    const video = mitJingle(ordner);
    fs.writeFileSync(path.join(ordner, "plan.json"), JSON.stringify({ id, datum, slot, art: "hinweis", hinweis: n, post: `${datum}-16`, video }) + "\n");
    console.log(`Story ${id}: Hinweis auf ${datum}-16 („${vorrat.hinweise[n]}“)`);
    ausgabe(`gebaut=true\nid=${id}\nart=hinweis\n`);
    return;
  }
  let wahl;
  if (kartenId) {
    const k = vorrat.karten.find((x) => x.id === kartenId);
    if (!k) throw new Error(`Karte ${kartenId} gibt es nicht`);
    wahl = { art: "karte", karte: k };
  } else {
    wahl = waehleMittag({ vorrat, log, datum, wetter: await wetterHeute(datum) });
  }
  if (!wahl) return nichts("Vorrat leer");
  const k = wahl.karte;
  pruefeWortfilter(k.inhalt);
  const bild = brauchtBild(k.inhalt) ? k.bild || waehleBild({ bibliothek, nutzung, log, datum, lage: k.lage }) : null;
  if (brauchtBild(k.inhalt) && !bild) return nichts("kein passendes Bild");
  karteRendern(ordner, id, k.inhalt, bild);
  const video = mitJingle(ordner);
  const plan = { id, datum, slot, art: wahl.art, bild, video, ...(wahl.art === "karte" ? { karte: k.id } : { wetter: k.wetter }) };
  fs.writeFileSync(path.join(ordner, "plan.json"), JSON.stringify(plan) + "\n");
  const rest = offeneKarten(vorrat.karten, [...log, plan], datum).length;
  console.log(`Story ${id}: ${wahl.art} ${k.id} (${k.inhalt.format}${bild ? `, ${bild}` : ""}), noch ${rest} Karten offen`);
  ausgabe(`gebaut=true\nid=${id}\nart=${wahl.art}\nrest=${rest}\n`);
}

async function posten(id) {
  const ordner = path.join(STORYS, id);
  const plan = JSON.parse(fs.readFileSync(path.join(ordner, "plan.json"), "utf8"));
  if (log.some((x) => x.id === id)) return console.log(`Story ${id} ist schon gepostet.`);
  const GRAPH = "https://graph.facebook.com";
  const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
  const IG = process.env.IG_USER_ID || "17841454284048783";
  const video = fs.existsSync(path.join(ordner, "story.mp4"));
  const url = `${process.env.SEITEN_URL || "https://oidaleberkas.at"}/tagebuch/storys/${id}/story.${video ? "mp4" : "jpg"}`;
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  // Warten, bis GitHub Pages die Datei ausliefert
  for (let i = 0; !(await fetch(url, { method: "HEAD" }).then((r) => r.ok).catch(() => false)); i++) {
    if (i >= 40) throw new Error("Story-Bild ist nach 10 Minuten noch nicht online");
    await warte(15000);
  }
  async function graph(pfad, felder) {
    const res = await fetch(`${GRAPH}/${pfad}`, { method: "POST", body: new URLSearchParams({ ...felder, access_token: TOKEN }) });
    const j = await res.json();
    if (!res.ok || j.error) throw new Error(`${pfad}: ${j.error?.message || res.status}`);
    return j;
  }
  const container = (await graph(`${IG}/media`, { media_type: "STORIES", ...(video ? { video_url: url } : { image_url: url }) })).id;
  for (let i = 0; ; i++) {
    const s = await (await fetch(`${GRAPH}/${container}?fields=status_code&access_token=${TOKEN}`)).json();
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR") throw new Error("Instagram konnte die Story nicht verarbeiten");
    if (i >= 60) throw new Error("Instagram braucht zu lange für die Story");
    await warte(5000);
  }
  const ig = await graph(`${IG}/media_publish`, { creation_id: container });
  log.push({ ...plan, ig: ig.id, zeit: new Date().toISOString() });
  fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + "\n");
  console.log(`Instagram: Story ${id} veröffentlicht (${ig.id})`);
}

async function vorschau(aus, datum, ids) {
  const vorrat = vorratLesen();
  fs.mkdirSync(aus, { recursive: true });
  const karten = ids.length ? ids.map((i) => vorrat.karten.find((k) => k.id === i) || (() => { throw new Error(`Karte ${i} gibt es nicht`); })()) : offeneKarten(vorrat.karten, log, datum);
  const tmp = path.join(STORYS, "vorschau");
  const schein = [...log];
  try {
    for (const k of karten) {
      const bild = brauchtBild(k.inhalt) ? k.bild || waehleBild({ bibliothek, nutzung, log: schein, datum, lage: k.lage }) : null;
      // Vorschau verteilt die Bilder wie mehrere Tage hintereinander, damit nicht jede Karte dasselbe zeigt
      schein.push({ datum, bild });
      karteRendern(tmp, `${datum}-vorschau`, k.inhalt, bild);
      fs.copyFileSync(path.join(tmp, "story.jpg"), path.join(aus, `${k.id}.jpg`));
      console.log(`${k.id}.jpg (${k.inhalt.format}${bild ? `, ${bild}` : ""})`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
const [befehl, ...arg] = process.argv.slice(2);
if (befehl === "bauen") {
  // Ohne Slot gilt die Wiener Uhrzeit (stündlicher Cron)
  // formatToParts, weil de-AT die Stunde als „16 Uhr“ ausgibt (Number() ergab NaN, kein Abend-Slot am 20.10.2026)
  const stunde = Number(new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).find((p) => p.type === "hour").value);
  const slot = arg[1] || slotFuer(stunde);
  if (!slot) { console.log("Kein Story-Slot zu dieser Uhrzeit."); ausgabe("gebaut=false\n"); } else await bauen(arg[0] || heute, slot, arg[2]);
}
else if (befehl === "posten") await posten(arg[0]);
else if (befehl === "vorschau") await vorschau(arg[0], arg[1] || heute, arg.slice(2));
else if (befehl === "pruefen") {
  const fehler = pruefeVorrat(roh, bibliothek);
  if (fehler.length) { console.log(fehler.map((f) => `✗ ${f}`).join("\n")); process.exit(1); }
  const v = Vorrat.parse(roh);
  console.log(`✓ storys.json in Ordnung: ${offeneKarten(v.karten, log, heute).length} Karten offen (von ${v.karten.length}), ${v.hinweise.length} Hinweise, Wetterzeilen ${Object.entries(v.wetter).map(([k, z]) => `${k} ${z.length}`).join(", ")}`);
} else throw new Error("Aufruf: node storys.mjs bauen|posten|pruefen|vorschau …");
