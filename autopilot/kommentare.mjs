// Beantwortet Kommentare auf Instagram und YouTube automatisch aus dem festen Pool antworten.json. Keine Claude-API, kostet nichts.
// Ablauf: neue Kommentare der letzten Tage holen → per Wortliste einordnen → Heikles nie beantworten, sondern melden →
// Harmloses bekommt eine Antwort aus dem Pool (höchstens MAX_TAG pro Tag, MAX_POST pro Post, jede Antwort höchstens alle 30 Tage).
// Gedächtnis: kommentare-log.json (nur IDs und unsere Antwort, keine Namen). Meldungen: Markdown nach BERICHT, der Workflow hängt sie ans Issue.
// KOMMENTARE_ANTWORTEN=aus → nur anzeigen, nichts posten. Fehlt ein Recht (instagram_manage_comments, youtube.force-ssl), wird die Plattform übersprungen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VERBOTEN } from "./wortfilter.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(HIER, "kommentare-log.json");
export const MAX_TAG = 10;
export const MAX_POST = 3;
const ALTER_TAGE = 10;
const SPERRE_TAGE = 30;

// Reihenfolge zählt: Sperren zuerst, dann die erste passende Kategorie
export const SPERREN = [
  ["Link oder Werbung", /https?:|www\.|\.(com|at|de|net|io)\b|t\.me|wa\.me|kooperation|collab|zusammenarbeit|werbung|sponsor|promo|business|dm me|schreib mir (eine )?dm|schreib mir privat|follower|abonnenten|check (my|mein)|mein profil|gewinnspiel|crypto|bitcoin|invest/i],
  ["Hass oder Beleidigung", /hure|schlampe|fotze|wichs|hurensohn|missgeburt|behindert|spast|nazi|hitler|neger|schwuchtel|kanake|fick|f\*ck|bitch|slut|whore|\bkys\b|bring dich um|stirb|kill yourself|arschloch|wixx|hässlich/i],
  ["sexuell oder Körper", /sex|nackt|nude|titt|brüste|boobs|\bass\b|sexy|heiß(?![\p{L}])|\bhot\b|körper|onlyfans|💦|🍆|🍑|👅/iu],
  ["Krise oder Trauer", /gestorben|verstorben|beerdigung|begräbnis|suizid|selbstmord|umbringen|ritze|ritzen|geritzt|nicht mehr leben|will sterben|depress|missbrauch|klinik|geht (es )?mir (so )?schlecht|mir geht es (so )?schlecht|mir gehts schlecht|traurig|einsam|ich weine|angst|hilfe!|bitte hilf/i],
  ["vermutlich minderjährig", /\bich bin (1[0-5]|[5-9])\b|\b(1[0-5]|[5-9]) jahre alt|volksschule|unterstufe|\b[1-4]\. klasse/i],
  ["Frage zu KI oder Echtheit", /\bki\b|\bai\b|künstlich|generiert|chatgpt|gemini|midjourney|\bbots?\b|bist du echt|ist das echt|\bfake\b|wer steckt|wer macht (das|die)|programm/i],
  ["Politik oder Religion", /övp|spö|fpö|grüne|neos|kickl|regierung|\bwahl|partei|politik|krieg|israel|gaza|palästin|ukrain|\brussland|\brussen|trump|putin|migra|flüchtl|ausländer|islam|jud(e|en)\b|kirche|religion|abtreib|gender/i],
];

export const KATEGORIEN = [
  ["herbert", /herbert|fledermaus|🦇/i],
  ["flirt", /heirat|\bdate\b|daten\b|single|deine nummer|nummer\?|verliebt|crush|freundin werden|hübsch|süß|schön bist|traumfrau|❤️‍🔥|😍|🥰|😘/i],
  ["kritik", /cringe|langweilig|unlustig|nicht lustig|ist schlecht|so schlecht|schlechter (post|witz)|peinlich|verstehe? (ich )?nicht|versteh ich nicht|sinnlos|\bmeh\b|👎/i],
  ["lachen", /😂|🤣|💀|😹|\bhaha|\bhihi|\blol\b|lmao|\blmfao|\bxd\b|ich kann nicht mehr|zu gut|ich lieg|ich sterbe|bin tot|\bomg\b/i],
  ["relatable", /\bsame\b|literally me|das bin ich|das bin ja ich|bin das|genau so|genauso|\bmood\b|so wahr|fühl ich|relatable|\breal\b|\bich auch\b|jeden tag|jeden morgen|jeden montag|kenn ich|kenne ich|\bmy life\b|mein leben|ich jeden/i],
  ["lob", /❤|🖤|🤍|💜|🔥|👏|😁|geil|\blieb|toll|beste|love|super|\bnice\b|stark|großartig|grossartig|genial|wunderbar|mag (dich|das|euch)|folge|abonniert|\bcool\b|\bwow\b/i],
];

const FRAGE = /\b(wer|was|wie|wo|warum|wieso|weshalb|wann|welche[rsn]?|kannst|könnt|kann man|gibt es|hast du|bist du|machst du)\b[^?]*\?/i;
const nurMarkiert = (t) => /^(\s*@[\w.]+[\s,]*)+[\s\p{Extended_Pictographic}\u{FE0F}]*$/u.test(t) && /@/.test(t);

// Ordnet einen Kommentar ein: { kategorie } zum Antworten, { sperre } zum Melden, { keine } zum Überspringen
export function einordnen(text) {
  const t = String(text || "").trim();
  if (!t) return { keine: "leer" };
  for (const [grund, re] of SPERREN) if (re.test(t)) return { sperre: grund };
  if (nurMarkiert(t)) return { kategorie: "markiert" };
  const ohneNamen = t.replace(/@[\w.]+/g, " ");
  if (ohneNamen.length > 220) return { keine: "zu lang" };
  const kat = KATEGORIEN.find(([, re]) => re.test(ohneNamen));
  // Echte Fragen beantwortet der Pool nicht (außer Flirt und Herbert, die haben passende Antworten)
  if (FRAGE.test(ohneNamen) && !(kat && ["flirt", "herbert"].includes(kat[0]))) return { keine: "Frage" };
  if (kat) return { kategorie: kat[0] };
  // Alles Harmlose ohne Treffer bekommt eine Allzweck-Antwort, solange es kurz ist (Dominik 20.10.2026: Test-Kommentar blieb sonst liegen)
  return ohneNamen.trim().length <= 140 ? { kategorie: "allgemein" } : { keine: "keine Kategorie" };
}

const tageZwischen = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;

// Wählt eine Antwort: nicht in den letzten 30 Tagen benutzt, nicht schon unter diesem Post; sonst die am längsten unbenutzte
export function waehlen(pool, kategorie, log, { post, datum, id = "" }) {
  const liste = pool[kategorie] || [];
  const zuletzt = new Map();
  for (const e of log.beantwortet) if (e.kat === kategorie) zuletzt.set(e.antwort, e.datum > (zuletzt.get(e.antwort) || "") ? e.datum : zuletzt.get(e.antwort));
  const unterPost = new Set(log.beantwortet.filter((e) => e.post === post).map((e) => e.antwort));
  const frei = liste.filter((a) => !unterPost.has(a) && (!zuletzt.has(a) || tageZwischen(zuletzt.get(a), datum) >= SPERRE_TAGE));
  if (!frei.length) return null;
  const nie = frei.filter((a) => !zuletzt.has(a));
  const auswahl = nie.length ? nie : frei.sort((a, b) => zuletzt.get(a).localeCompare(zuletzt.get(b))).slice(0, 3);
  // Streuung über die Kommentar-ID, damit nicht immer die erste Antwort der Liste kommt
  const h = [...id].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  return auswahl[h % auswahl.length];
}

// Entscheidet für eine Liste neuer Kommentare, was passiert. Rein, ohne Netz; testbar.
// kommentare: [{ id, plattform, post, link, text, zeit }]
export function planen(kommentare, log, pool, datum) {
  const erledigt = new Set([...log.beantwortet.map((e) => e.id), ...log.gemeldet]);
  let heute = log.beantwortet.filter((e) => e.datum === datum).length;
  const proPost = new Map();
  for (const e of log.beantwortet) proPost.set(e.post, (proPost.get(e.post) || 0) + 1);
  const antworten = [], melden = [], uebersprungen = [];
  for (const k of [...kommentare].sort((a, b) => a.zeit.localeCompare(b.zeit))) {
    if (erledigt.has(k.id)) continue;
    if (tageZwischen(k.zeit, datum + "T23:59:59Z") > ALTER_TAGE) continue;
    const e = einordnen(k.text);
    if (e.sperre) { melden.push({ ...k, grund: e.sperre }); continue; }
    if (e.keine) { uebersprungen.push({ ...k, grund: e.keine }); continue; }
    if (heute >= MAX_TAG) { uebersprungen.push({ ...k, grund: "Tageslimit" }); continue; }
    if ((proPost.get(k.post) || 0) >= MAX_POST) { uebersprungen.push({ ...k, grund: "Limit pro Post" }); continue; }
    const antwort = waehlen(pool, e.kategorie, { beantwortet: [...log.beantwortet, ...antworten.map((a) => ({ ...a, datum }))] }, { post: k.post, datum, id: k.id });
    if (!antwort) { uebersprungen.push({ ...k, grund: `Pool „${e.kategorie}“ aufgebraucht` }); continue; }
    if (VERBOTEN.test(antwort)) throw new Error(`Verbotenes Wort im Pool: ${antwort}`);
    antworten.push({ id: k.id, plattform: k.plattform, post: k.post, kat: e.kategorie, antwort, text: k.text });
    heute++;
    proPost.set(k.post, (proPost.get(k.post) || 0) + 1);
  }
  return { antworten, melden, uebersprungen };
}

// Sichtbarer Auszug für das öffentliche Issue: ohne @Namen, kurz; bei Hass und Sexuellem gar kein Text
export function auszug(k) {
  if (/Hass|sexuell/.test(k.grund)) return "(Text nicht zitiert)";
  const t = k.text.replace(/@[\w.]+/g, "@…").replace(/\s+/g, " ").trim();
  return `„${t.length > 90 ? t.slice(0, 89) + "…" : t}“`;
}

export function bericht(melden, datum) {
  if (!melden.length) return "";
  const dringend = melden.some((k) => /Krise|Hass/.test(k.grund));
  return [
    `## Kommentare ${datum}: für dich${dringend ? " (bitte bald ansehen)" : ""}`,
    "",
    "Diese Kommentare beantwortet der Autopilot nie. Antworten, ausblenden oder löschen kannst nur du in der App.",
    "",
    ...melden.map((k) => `- **${k.grund}** (${k.plattform === "ig" ? "Instagram" : "YouTube"}): ${auszug(k)} · [ansehen](${k.link})`),
  ].join("\n");
}

// ---------- Netz ----------
const GRAPH = "https://graph.facebook.com/v21.0";
const zeitlimit = () => AbortSignal.timeout(15000);

async function instagram(token, seit) {
  const ig = process.env.IG_USER_ID || "17841454284048783";
  const g = async (pfad, params = {}) => {
    const j = await (await fetch(`${GRAPH}/${pfad}?${new URLSearchParams({ ...params, access_token: token })}`, { signal: zeitlimit() })).json();
    if (j.error) throw new Error(j.error.message);
    return j;
  };
  const ich = (await g(ig, { fields: "username" })).username;
  const media = (await g(`${ig}/media`, { fields: "id,permalink,timestamp,comments_count", limit: "25" })).data.filter((m) => m.timestamp >= seit && m.comments_count > 0);
  const liste = [];
  for (const m of media) {
    const c = await g(`${m.id}/comments`, { fields: "id,text,username,timestamp,replies{username}", limit: "50" });
    for (const k of c.data) {
      if (k.username === ich || (k.replies?.data || []).some((r) => r.username === ich)) continue;
      liste.push({ id: k.id, plattform: "ig", post: m.id, link: m.permalink, text: k.text, zeit: k.timestamp });
    }
  }
  const antworten = async (id, text) => {
    const res = await fetch(`${GRAPH}/${id}/replies`, { method: "POST", body: new URLSearchParams({ message: text, access_token: token }), signal: zeitlimit() });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message);
  };
  return { liste, antworten };
}

async function youtube(env, seit) {
  const t = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: env.YOUTUBE_CLIENT_ID, client_secret: env.YOUTUBE_CLIENT_SECRET, refresh_token: env.YOUTUBE_REFRESH_TOKEN, grant_type: "refresh_token" }), signal: zeitlimit() })).json();
  if (!t.access_token) throw new Error(t.error_description || t.error || "kein Token");
  if (!String(t.scope).includes("youtube.force-ssl")) throw new Error("Der Refresh-Token hat den Bereich youtube.force-ssl nicht (zum Antworten nötig)");
  const auth = { authorization: `Bearer ${t.access_token}` };
  const api = async (pfad, opt = {}) => {
    const j = await (await fetch(`https://www.googleapis.com/youtube/v3/${pfad}`, { ...opt, headers: { ...auth, ...(opt.headers || {}) }, signal: zeitlimit() })).json();
    if (j.error) throw new Error(j.error.message);
    return j;
  };
  const kanal = (await api("channels?part=id&mine=true")).items[0].id;
  const j = await api(`commentThreads?part=snippet,replies&allThreadsRelatedToChannelId=${kanal}&maxResults=100&order=time&textFormat=plainText`);
  const liste = [];
  for (const th of j.items || []) {
    const top = th.snippet.topLevelComment.snippet;
    if (top.publishedAt < seit || !th.snippet.canReply) continue;
    if (top.authorChannelId?.value === kanal || (th.replies?.comments || []).some((r) => r.snippet.authorChannelId?.value === kanal)) continue;
    liste.push({ id: th.id, plattform: "yt", post: th.snippet.videoId, link: `https://www.youtube.com/watch?v=${th.snippet.videoId}&lc=${th.id}`, text: top.textOriginal || top.textDisplay, zeit: top.publishedAt });
  }
  const antworten = (id, text) => api("comments?part=snippet", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ snippet: { parentId: id, textOriginal: text } }) });
  return { liste, antworten };
}

export function logLesen() {
  try { return JSON.parse(fs.readFileSync(LOG, "utf8")); } catch { return { beantwortet: [], gemeldet: [] }; }
}

async function main() {
  const env = process.env;
  const datum = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
  const seit = new Date(Date.now() - ALTER_TAGE * 864e5).toISOString();
  const live = env.KOMMENTARE_ANTWORTEN !== "aus";
  const pool = JSON.parse(fs.readFileSync(path.join(HIER, "antworten.json"), "utf8"));
  const log = logLesen();

  const quellen = {};
  const alle = [];
  for (const [name, holen] of [
    ["ig", () => (env.INSTAGRAM_ACCESS_TOKEN ? instagram(env.INSTAGRAM_ACCESS_TOKEN, seit) : Promise.reject(new Error("kein Token")))],
    ["yt", () => (env.YOUTUBE_REFRESH_TOKEN ? youtube(env, seit) : Promise.reject(new Error("keine YouTube-Secrets")))],
  ]) {
    try {
      quellen[name] = await holen();
      alle.push(...quellen[name].liste);
      console.log(`${name}: ${quellen[name].liste.length} offene Kommentare`);
    } catch (err) {
      console.log(`${name}: übersprungen (${err.message})`);
    }
  }

  const plan = planen(alle, log, pool, datum);
  for (const u of plan.uebersprungen) console.log(`– ${u.plattform} ${u.id}: ${u.grund}`);
  for (const m of plan.melden) console.log(`! ${m.plattform} ${m.id}: ${m.grund}`);
  for (const a of plan.antworten) {
    console.log(`${live ? "→" : "(Probe) →"} ${a.plattform} ${a.id} [${a.kat}] „${a.text.slice(0, 60)}“ ⇒ „${a.antwort}“`);
    if (!live) continue;
    try {
      await quellen[a.plattform].antworten(a.id, a.antwort);
      log.beantwortet.push({ id: a.id, p: a.plattform, post: a.post, kat: a.kat, antwort: a.antwort, datum });
    } catch (err) {
      console.log(`  Antwort gescheitert: ${err.message}`);
    }
  }
  if (live && (plan.antworten.length || plan.melden.length)) {
    log.gemeldet.push(...plan.melden.map((m) => m.id));
    // Älteres als 60 Tage vergessen, damit die Datei klein bleibt (Sperrfrist ist 30 Tage)
    const grenze = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    log.beantwortet = log.beantwortet.filter((e) => e.datum >= grenze);
    log.gemeldet = log.gemeldet.slice(-500);
    fs.writeFileSync(LOG, JSON.stringify(log, null, 1) + "\n");
  }
  if (env.BERICHT) fs.writeFileSync(env.BERICHT, bericht(plan.melden, datum));
  console.log(`Fertig: ${plan.antworten.length} Antworten, ${plan.melden.length} gemeldet, ${plan.uebersprungen.length} übersprungen.`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
