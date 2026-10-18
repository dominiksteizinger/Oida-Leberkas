// Rendert die zwei Karussell-Folien (1080x1350) und trägt den Eintrag ins Tagebuch der Webseite ein.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const WURZEL = path.join(HIER, "..");
const datum = process.argv[2];
if (!datum) throw new Error("Aufruf: node render.mjs <datum>");
const ordner = path.join(WURZEL, "tagebuch", datum);
const e = JSON.parse(fs.readFileSync(path.join(ordner, "eintrag.json"), "utf8"));
const bibliothek = JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8"));
const art = (datei) => bibliothek.find((b) => b.datei === datei)?.art;

const schrift = (f) => `file://${path.join(WURZEL, "assets", "fonts", f)}`;
const bild = (f) => `file://${path.join(HIER, "bilder", f)}`;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const groesse1 = e.folie1.length > 110 ? 78 : e.folie1.length > 70 ? 90 : 104;
const groesse2 = e.folie2.length > 55 ? 92 : e.folie2.length > 30 ? 108 : 128;

const kopf = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:G;src:url(${schrift("grenze-gotisch.woff2")})}
@font-face{font-family:C;font-style:italic;src:url(${schrift("cormorant-garamond-italic.woff2")})}
@font-face{font-family:N;font-weight:400 900;src:url(${schrift("nunito.woff2")})}
@font-face{font-family:S;font-weight:600;src:url(${schrift("cormorant-garamond-semibold.woff2")})}
html,body{margin:0}
.f{width:1080px;height:1350px;box-sizing:border-box;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between}
</style></head><body>`;

const folie1 = `${kopf}<div class="f" style="background:#15161B;padding:120px 110px 90px;color:#DADCE3">
<img src="${bild(e.bild_folie1)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:grayscale(.75) brightness(.32) blur(2px)">
<svg viewBox="0 0 1080 1350" width="1080" height="1350" style="position:absolute;inset:0;opacity:.5"><path d="M120 0 l-30 140 M300 60 l-30 140 M520 0 l-30 140 M760 90 l-30 140 M950 10 l-30 140 M200 420 l-30 140 M640 380 l-30 140 M880 520 l-30 140 M90 820 l-30 140 M420 900 l-30 140 M1000 860 l-30 140 M700 1120 l-30 140" stroke="#8A8EA0" stroke-width="2"/></svg>
<p style="margin:0;position:relative;font:400 28px N;letter-spacing:.3em;color:#9A9DAB">I.</p>
<p style="margin:0;position:relative;font:italic 500 ${groesse1}px/1.12 C;text-shadow:0 2px 24px rgba(0,0,0,.6)">${esc(e.folie1)}</p>
<p style="margin:0;position:relative;font:400 28px N;color:#9A9DAB;text-align:right">wisch weiter</p>
</div></body></html>`;

const passung = art(e.bild_folie2) === "figur" ? "cover;object-position:center 4%" : "cover";
const folie2 = `${kopf}<div class="f" style="background:radial-gradient(ellipse at 50% 62%,#3a1430 0,#0D090C 62%);padding:100px 96px 76px;color:#F3E6EC;align-items:center">
<div style="position:absolute;top:0;left:0;right:0;height:30px;background-image:radial-gradient(circle at 50% 0,#FF4FA3 0 9px,transparent 10px),radial-gradient(circle at 50% 0,#2B1A25 0 17px,transparent 18px);background-size:40px 30px"></div>
<p style="margin:0;align-self:stretch;font:600 ${groesse2}px/1.04 S;color:#FF4FA3;text-shadow:0 0 40px rgba(255,79,163,.35)">${esc(e.folie2)}</p>
<div style="width:580px;height:660px;background:#fff;border:6px solid #FF4FA3;border-radius:290px 290px 24px 24px;overflow:hidden;box-shadow:0 0 90px rgba(255,79,163,.45)">
<img src="${bild(e.bild_folie2)}" style="width:100%;height:100%;object-fit:${passung};display:block">
</div>
<p style="margin:0;align-self:flex-end;font:900 56px G;color:#C9A86A">Oida Leberkas</p>
</div></body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: ["--allow-file-access-from-files"],
});
const seite = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [name, html] of [["folie-1", folie1], ["folie-2", folie2]]) {
  const tmp = path.join(ordner, `${name}.html`);
  fs.writeFileSync(tmp, html);
  await seite.goto(`file://${tmp}`);
  await seite.evaluate(() => document.fonts.ready);
  await seite.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await seite.screenshot({ path: path.join(ordner, `${name}.jpg`), type: "jpeg", quality: 90 });
  fs.unlinkSync(tmp);
}
await browser.close();

const liste = path.join(WURZEL, "tagebuch", "eintraege.json");
const alle = fs.existsSync(liste) ? JSON.parse(fs.readFileSync(liste, "utf8")) : [];
const neu = { datum, folie1: e.folie1, folie2: e.folie2, bild_folie1: e.bild_folie1, bild_folie2: e.bild_folie2, bilder: [`tagebuch/${datum}/folie-1.jpg`, `tagebuch/${datum}/folie-2.jpg`] };
fs.writeFileSync(liste, JSON.stringify([neu, ...alle.filter((x) => x.datum !== datum)], null, 2) + "\n");
console.log(`Folien gerendert: tagebuch/${datum}/folie-1.jpg und folie-2.jpg`);
