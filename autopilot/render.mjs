// Rendert einen Post (1080x1350) in zwei Stufen und trägt ihn ins Tagebuch der Webseite ein:
// tagebuch/<id>/post-a.jpg (nur Setup), post.jpg (ganzer Post) und schritt-NN.png (Teile nacheinander, fürs Reel in 1080x1920).
// Reel-Bilder: bei Fotos liegen nur Karten und Text auf transparentem Grund (das Foto füllt video.mjs als Vollbild mit leichtem Zoom
// darunter), bei Reaktionsbildern und Karten ohne Bild ist das ganze Bild undurchsichtig. Alles liegt in den sicheren Zonen von Instagram/YouTube.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { FORMATE, OHNE_BILD } from "./formate.mjs";
import { kurzfassung } from "./eintrag.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const WURZEL = path.join(HIER, "..");
const id = process.argv[2];
if (!id) throw new Error("Aufruf: node render.mjs <id>");
const ordner = path.join(WURZEL, "tagebuch", id);
const e = JSON.parse(fs.readFileSync(path.join(ordner, "eintrag.json"), "utf8"));
const bibliothek = JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8"));
const i = e.inhalt;

const datei = (p) => `file://${p}`;
const minute = (e.datum.split("-").reduce((a, x) => a + Number(x), 0) * 7) % 50 + 3;
const zeitstempel = `${new Date(e.datum + "T12:00:00").toLocaleDateString("de-AT", { day: "numeric", month: "long", year: "numeric" })} um ${e.slot}:${String(minute).padStart(2, "0")}`;
const optionen = {
  bild: e.bild ? datei(path.join(HIER, "bilder", e.bild)) : "",
  hell: bibliothek.find((b) => b.datei === e.bild)?.art === "figur",
  gesicht: datei(path.join(HIER, "vorlagen", "gesicht.png")),
  schrift: (f) => datei(path.join(WURZEL, "assets", "fonts", f)),
  handle: process.env.HANDLE || "resi.requiem",
  zeitstempel,
};
if (!OHNE_BILD.has(i.format) && !e.bild) throw new Error(`Format ${i.format} braucht ein Bild`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--allow-file-access-from-files"],
});
const seite = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
// Texte, die schon im Setup stehen; was im ganzen Post neu dazukommt, erscheint im Reel Schritt für Schritt
let setupTexte = [];
// Diese Teile erscheinen immer einzeln, auch wenn sie schon im Setup stehen (Chat-Blasen, Notiz-Absätze)
const EINZELN = { chat: ".m", notiz: "p" };
// Alle Elemente mit eigenem Text, ohne Handle und Label
function blattTexte() {
  return [...document.querySelectorAll(".f *")]
    .filter((e) => !e.children.length && e.textContent.trim() && !e.closest(".handle, .lab"))
    .map((e) => e.textContent.trim());
}

// Sichere Zonen im Reel (1080x1920): oben und unten liegen die Oberflächen von Instagram und YouTube.
// Der 1350 hohe Post sitzt mit diesem Abstand oben in der Mitte, darunter bleiben ca. 285 px frei.
const RAND_OBEN = 285;
const KOPF_PUFFER = 30;
// Aufforderungen („Schick das …“) kommen im Reel erst am Ende, nie als erster Text
const AUFRUF = /^\s*(schick|sende|leite)\w*\s+(das|es|dies|diesen|dieses|den|die|dem|der)\b/i;

// Foto-Modus: Karten auf transparentem Grund, Bild kommt als Vollbild darunter. Sonst: undurchsichtiges Bild.
async function reelModus() {
  if (OHNE_BILD.has(i.format) || optionen.hell) return "opak";
  const [b, h] = await seite.evaluate(() => { const x = document.querySelector("img.bg, img.fig, img.bild"); return x ? [x.naturalWidth, x.naturalHeight] : [0, 0]; });
  return b / h > 0.9 ? "breit" : "foto";
}

// Karten und Text im Reel (Vollbild 1080x1920): Der Post sitzt im sicheren Bereich, Handle nach oben, nichts über dem Gesicht.
const reelCss = (modus) => `
html,body{height:1920px;overflow:hidden}.f{margin-top:${RAND_OBEN}px}
.handle{bottom:auto!important;top:24px;text-shadow:0 2px 10px rgba(0,0,0,.8)}.st{bottom:150px!important}
${modus === "opak" ? "" : `.f{background:transparent!important}.bg,.fig,.bild,.fade,.verlauf{display:none!important}
body{position:relative}body::before{content:"";position:absolute;left:0;right:0;bottom:0;height:1000px;background:linear-gradient(transparent,rgba(13,10,13,.6))}
.f>.t{top:860px!important}.f>.t p,.f>.t .k{background:rgba(13,10,13,.82);padding:10px 22px;border-radius:14px;display:table;margin:0 0 14px}`}`;

// Elemente, die oben im Post stehen, rutschen unter das Gesicht (Kinn aus bibliothek.json), ohne andere Karten zu überdecken
async function ausKopfRaus(kinn) {
  await seite.evaluate(({ kinn, rand }) => {
    const kinden = [...document.querySelector(".f").children].filter((e) => !e.matches(".handle, img, .fade, .verlauf") && getComputedStyle(e).position === "absolute");
    const frame = document.querySelector(".f").getBoundingClientRect().top;
    const tops = kinden.map((e) => ({ e, r: e.getBoundingClientRect() })).map(({ e, r }) => ({ e, oben: r.top - frame, h: r.height, unten: r.bottom - frame }));
    const grenze = Math.min(kinn * 1920 - rand + 30, 700);
    for (const t of tops) {
      if (getComputedStyle(t.e).top === "auto" || t.oben >= grenze) continue;
      let ziel = grenze;
      // Nicht auf eine andere Karte schieben: lieber direkt darüber bleiben
      for (const u of tops) if (u !== t && u.oben >= t.unten && ziel + t.h > u.oben - 12) ziel = Math.max(t.oben, u.oben - t.h - 12);
      t.e.style.transform = `translateY(${ziel - t.oben}px)`;
    }
  }, { kinn, rand: RAND_OBEN });
}

// Blendet die neuen Teile aus und deckt sie einzeln auf: schritt-00.png (Setup), schritt-01.png … (je ein Teil mehr), am Ende die Aufforderung.
// Bei Chat und Notiz erscheint auch das Setup Blase für Blase bzw. Absatz für Absatz. Ergebnis für video.mjs: schritte.json mit Modus und Schritten.
async function schritte(setup) {
  const modus = await reelModus();
  await seite.setViewportSize({ width: 1080, height: 1920 });
  await seite.addStyleTag({ content: reelCss(modus) });
  if (modus === "opak") await seite.evaluate(() => { document.documentElement.style.background = getComputedStyle(document.querySelector(".f")).backgroundColor; });
  const kopf = bibliothek.find((b) => b.datei === e.bild)?.kopf;
  if (modus === "foto" && kopf) await ausKopfRaus(kopf[1]);
  const aufruf = AUFRUF.source;
  const texte = await seite.evaluate(({ setup, einzeln, aufruf }) => {
    const re = new RegExp(aufruf, "i");
    const blaetter = [...document.querySelectorAll(".f *")].filter((e) => !e.children.length && e.textContent.trim() && !e.closest(".handle, .lab"));
    // Aufforderungen („Schick das …“) erst im letzten Schritt zeigen
    const spaet = blaetter.filter((e) => re.test(e.textContent));
    const rest = [...setup];
    const neu = new Set();
    for (const e of blaetter) {
      const k = rest.indexOf(e.textContent.trim());
      if (k >= 0) rest.splice(k, 1);
      if (spaet.includes(e)) continue;
      if (k < 0 || (einzeln && e.closest(einzeln))) neu.add(e);
    }
    // Zusammengehörige Teile (z. B. eine ganze Mitteilung) als ein Schritt: hochgehen, solange der Elternknoten nur neue Texte enthält
    const gruppen = [];
    for (const e of neu) {
      let g = einzeln && e.closest(einzeln) ? e.closest(einzeln) : e;
      while (!(einzeln && g.matches(einzeln)) && g.parentElement && !g.parentElement.matches(".f, .card, body") && [...g.parentElement.querySelectorAll("*")].filter((x) => !x.children.length && x.textContent.trim()).every((x) => neu.has(x))) g = g.parentElement;
      if (!gruppen.some((x) => x.contains(g))) gruppen.push(g);
    }
    const ganz = spaet.map((e) => e.closest(".reply, .m, p, .k, .card") || e);
    gruppen.forEach((g, n) => { g.dataset.schritt = n; g.style.visibility = "hidden"; });
    ganz.forEach((g, n) => { g.dataset.schritt = gruppen.length + n; g.style.visibility = "hidden"; });
    const setupOhne = [...setup].filter((t) => !spaet.some((e) => e.textContent.trim() === t));
    return { schritte: [...gruppen, ...ganz].map((g) => g.textContent.replace(/\s+/g, " ").trim()), setup: setupOhne };
  }, { setup, einzeln: EINZELN[i.format] || null, aufruf });
  const liste = [];
  const anzahl = texte.schritte.length;
  for (let n = 0; n <= anzahl; n++) {
    if (n > 0) await seite.evaluate((k) => { document.querySelector(`[data-schritt="${k}"]`).style.visibility = "visible"; }, n - 1);
    const datei = `schritt-${String(n).padStart(2, "0")}.png`;
    await seite.screenshot({ path: path.join(ordner, datei), type: "png", omitBackground: modus !== "opak" });
    liste.push({ datei, text: n === 0 ? texte.setup.join(" ") : texte.schritte[n - 1] });
  }
  fs.writeFileSync(path.join(ordner, "schritte.json"), JSON.stringify({ modus, schritte: liste }, null, 2) + "\n");
}
for (const [stufe, name] of [["a", "post-a"], ["b", "post"]]) {
  const tmp = path.join(ordner, `${name}.html`);
  fs.writeFileSync(tmp, FORMATE[i.format](i, { ...optionen, stufe }));
  await seite.goto(`file://${tmp}`);
  await seite.evaluate(() => document.fonts.ready);
  await seite.waitForFunction(() => [...document.images].every((b) => b.complete && b.naturalWidth > 0));
  await seite.screenshot({ path: path.join(ordner, `${name}.jpg`), type: "jpeg", quality: 90 });
  if (stufe === "a") setupTexte = await seite.evaluate(blattTexte);
  else await schritte(setupTexte);
  fs.unlinkSync(tmp);
}

await browser.close();

const liste = path.join(WURZEL, "tagebuch", "eintraege.json");
const alle = fs.existsSync(liste) ? JSON.parse(fs.readFileSync(liste, "utf8")) : [];
const neu = { id, datum: e.datum, slot: e.slot, format: i.format, bild: e.bild || null, text: kurzfassung(i), bilder: [`tagebuch/${id}/post.jpg`] };
fs.writeFileSync(liste, JSON.stringify([neu, ...alle.filter((x) => (x.id || x.datum) !== id)], null, 2) + "\n");
console.log(`Gerendert: tagebuch/${id}/post.jpg (${i.format})`);
