// Rendert neue Posts als Vorschau-Bilder (fertiges Meme, wie im Feed), ohne Tagebuch oder Webseite zu verändern.
//   node vorschau.mjs <neu.json> <ausgabe-ordner>
// neu.json wie bei pruefen.mjs. Ergebnis: <ausgabe-ordner>/NN.jpg pro Post. Für den Wochenbericht im Projekt-Thread.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const TAGEBUCH = path.join(HIER, "..", "tagebuch");
const [datei, aus] = process.argv.slice(2);
if (!datei || !aus) throw new Error("Aufruf: node vorschau.mjs <neu.json> <ausgabe-ordner>");
const posts = JSON.parse(fs.readFileSync(datei, "utf8"));
fs.mkdirSync(aus, { recursive: true });

// render.mjs trägt jeden Post in eintraege.json ein; die Datei wird danach wiederhergestellt
const liste = path.join(TAGEBUCH, "eintraege.json");
const vorher = fs.existsSync(liste) ? fs.readFileSync(liste) : null;
// Im Actions-Runner liegt Chrome unter /usr/bin, in Claude-Sitzungen der vorinstallierte Chromium
const chrome = process.env.CHROME_PATH || ["/usr/bin/google-chrome", "/opt/pw-browsers/chromium"].find((p) => fs.existsSync(p));
const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
try {
  posts.forEach(({ titel, notiz, ...post }, n) => {
    const nr = String(n + 1).padStart(2, "0");
    const id = `vorschau-${nr}`;
    const ordner = path.join(TAGEBUCH, id);
    fs.mkdirSync(ordner, { recursive: true });
    try {
      fs.writeFileSync(path.join(ordner, "eintrag.json"), JSON.stringify({ id, datum: post.ab || heute, slot: post.slot || "16", ...post }, null, 2));
      execFileSync("node", [path.join(HIER, "render.mjs"), id], { stdio: "inherit", env: { ...process.env, CHROME_PATH: chrome } });
      fs.copyFileSync(path.join(ordner, "post.jpg"), path.join(aus, `${nr}.jpg`));
      console.log(`${nr}.jpg: ${titel}`);
    } finally {
      fs.rmSync(ordner, { recursive: true, force: true });
    }
  });
} finally {
  if (vorher) fs.writeFileSync(liste, vorher);
}
