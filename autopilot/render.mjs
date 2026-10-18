// Rendert einen Post (1080x1350) in zwei Stufen und trägt ihn ins Tagebuch der Webseite ein:
// tagebuch/<id>/post-a.jpg (nur Setup, für den Anfang des Reels) und post.jpg (ganzer Post).
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
for (const [stufe, name] of [["a", "post-a"], ["b", "post"]]) {
  const tmp = path.join(ordner, `${name}.html`);
  fs.writeFileSync(tmp, FORMATE[i.format](i, { ...optionen, stufe }));
  await seite.goto(`file://${tmp}`);
  await seite.evaluate(() => document.fonts.ready);
  await seite.waitForFunction(() => [...document.images].every((b) => b.complete && b.naturalWidth > 0));
  await seite.screenshot({ path: path.join(ordner, `${name}.jpg`), type: "jpeg", quality: 90 });
  fs.unlinkSync(tmp);
}
await browser.close();

const liste = path.join(WURZEL, "tagebuch", "eintraege.json");
const alle = fs.existsSync(liste) ? JSON.parse(fs.readFileSync(liste, "utf8")) : [];
const neu = { id, datum: e.datum, slot: e.slot, format: i.format, bild: e.bild || null, text: kurzfassung(i), bilder: [`tagebuch/${id}/post.jpg`] };
fs.writeFileSync(liste, JSON.stringify([neu, ...alle.filter((x) => (x.id || x.datum) !== id)], null, 2) + "\n");
console.log(`Gerendert: tagebuch/${id}/post.jpg (${i.format})`);
