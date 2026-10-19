// Erzeugt neue Resi-Bilder über die Gemini-API (kostet ca. 3–7 Cent pro Bild, Secret GEMINI_API_KEY).
// Schickt das Referenz-Sheet mit, damit Resi und Herbert gleich aussehen. Hochformat 9:16 wie in figur/prompts-7.md.
//   node bildgen.mjs <auftraege.json> <ausgabe-ordner>
// auftraege.json: [{ "datei": "name.png", "szene": "englische Szenenbeschreibung" }]. Höchstens BILD_MAX (Standard 5) pro Lauf.
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const [datei, aus] = process.argv.slice(2);
if (!datei || !aus) throw new Error("Aufruf: node bildgen.mjs <auftraege.json> <ausgabe-ordner>");
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) throw new Error("GEMINI_API_KEY fehlt");
const MAX = Number(process.env.BILD_MAX || 5);
// Neuere Modellnamen zuerst; fehlt eins (404), kommt das nächste dran
const MODELLE = (process.env.BILD_MODELL || "gemini-2.5-flash-image,gemini-3-pro-image-preview,gemini-2.5-flash-image-preview").split(",");

export const FIGUR = `This is my original character Resi. Keep her exactly consistent with the attached reference sheet: an adult woman in her mid-20s, anime style, normal adult proportions, long straight black hair with blunt bangs and one hot pink streak, winged eyeliner, plum lipstick, pink heart choker, black lace blouse, black corset-style vest, black pleated skirt, ripped black tights, chunky platform boots. Her face is calm and deadpan, never overly emotional. Clean anime line art, soft cel shading, gothic colors black, pink and lavender. Wholesome and playful, never sexualized, no text, letters or logos in the image. "Herbert" is her pet: a tiny cute black bat.

FORMAT: tall vertical 9:16, like a phone screen. Never square, never landscape. Composition: Resi in the horizontal center, face turned toward the viewer with both eyes clearly visible, her face about one third from the top. Herbert is always in the image, close to her head or shoulder. Nothing important near the left or right edge. The top 15 % and the bottom 30 % of the image stay calm and uncluttered, because text will be placed there.

Scene: `;

const referenz = fs.readFileSync(path.join(HIER, "referenz", "referenz-sheet.jpg")).toString("base64");
let modell = null;

async function erzeuge(szene) {
  for (const m of modell ? [modell] : MODELLE) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ inlineData: { mimeType: "image/jpeg", data: referenz } }, { text: FIGUR + szene }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } },
      }),
    });
    const j = await res.json();
    if (res.status === 404) { console.log(`Modell ${m} gibt es nicht, nächstes.`); continue; }
    if (j.error) throw new Error(`${m}: ${j.error.message}`);
    const bild = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!bild) throw new Error(`${m}: kein Bild in der Antwort (${j.candidates?.[0]?.finishReason || "?"})`);
    modell = m;
    return Buffer.from(bild.data, "base64");
  }
  throw new Error("Kein Bildmodell verfügbar");
}

const auftraege = JSON.parse(fs.readFileSync(datei, "utf8")).slice(0, MAX);
fs.mkdirSync(aus, { recursive: true });
let fehler = 0;
for (const a of auftraege) {
  try {
    fs.writeFileSync(path.join(aus, a.datei), await erzeuge(a.szene));
    console.log(`✓ ${a.datei} (${modell})`);
  } catch (err) {
    fehler++;
    console.log(`✗ ${a.datei}: ${err.message}`);
  }
}
if (fehler === auftraege.length) process.exit(1);
