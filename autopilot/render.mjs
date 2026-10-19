// Rendert einen Post (1080x1350) in zwei Stufen und trägt ihn ins Tagebuch der Webseite ein:
// tagebuch/<id>/post-a.jpg (nur Setup), post.jpg (ganzer Post) und schritt-NN.jpg (Teile nacheinander, fürs Reel).
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

// Alle Elemente mit eigenem Text, ohne Handle und Label
function blattTexte() {
  return [...document.querySelectorAll(".f *")]
    .filter((e) => !e.children.length && e.textContent.trim() && !e.closest(".handle, .lab"))
    .map((e) => e.textContent.trim());
}

// Blendet die neuen Teile aus und deckt sie einzeln auf: schritt-00.jpg (Setup), schritt-01.jpg … (je ein Teil mehr).
// Bei Chat und Notiz erscheint auch das Setup Blase für Blase bzw. Absatz für Absatz. Ergebnis für video.mjs: schritte.json mit Datei und Text.
async function schritte(setup) {
  const texte = await seite.evaluate(({ setup, einzeln }) => {
    const blaetter = [...document.querySelectorAll(".f *")].filter((e) => !e.children.length && e.textContent.trim() && !e.closest(".handle, .lab"));
    const rest = [...setup];
    const neu = new Set();
    for (const e of blaetter) {
      const k = rest.indexOf(e.textContent.trim());
      if (k >= 0) rest.splice(k, 1);
      if (k < 0 || (einzeln && e.closest(einzeln))) neu.add(e);
    }
    // Zusammengehörige Teile (z. B. eine ganze Mitteilung) als ein Schritt: hochgehen, solange der Elternknoten nur neue Texte enthält
    const gruppen = [];
    for (const e of neu) {
      let g = einzeln && e.closest(einzeln) ? e.closest(einzeln) : e;
      while (!(einzeln && g.matches(einzeln)) && g.parentElement && !g.parentElement.matches(".f, .card, body") && [...g.parentElement.querySelectorAll("*")].filter((x) => !x.children.length && x.textContent.trim()).every((x) => neu.has(x))) g = g.parentElement;
      if (!gruppen.some((x) => x.contains(g))) gruppen.push(g);
    }
    gruppen.forEach((g, n) => { g.dataset.schritt = n; g.style.visibility = "hidden"; });
    return gruppen.map((g) => g.textContent.replace(/\s+/g, " ").trim());
  }, { setup, einzeln: EINZELN[i.format] || null });
  const liste = [];
  for (let n = 0; n <= texte.length; n++) {
    if (n > 0) await seite.evaluate((k) => { document.querySelector(`[data-schritt="${k}"]`).style.visibility = "visible"; }, n - 1);
    const datei = `schritt-${String(n).padStart(2, "0")}.jpg`;
    await seite.screenshot({ path: path.join(ordner, datei), type: "jpeg", quality: 90 });
    liste.push({ datei, text: n === 0 ? setup.join(" ") : texte[n - 1] });
  }
  fs.writeFileSync(path.join(ordner, "schritte.json"), JSON.stringify(liste, null, 2) + "\n");
}
await browser.close();

const liste = path.join(WURZEL, "tagebuch", "eintraege.json");
const alle = fs.existsSync(liste) ? JSON.parse(fs.readFileSync(liste, "utf8")) : [];
const neu = { id, datum: e.datum, slot: e.slot, format: i.format, bild: e.bild || null, text: kurzfassung(i), bilder: [`tagebuch/${id}/post.jpg`] };
fs.writeFileSync(liste, JSON.stringify([neu, ...alle.filter((x) => (x.id || x.datum) !== id)], null, 2) + "\n");
console.log(`Gerendert: tagebuch/${id}/post.jpg (${i.format})`);
