// Erzeugt mit Gemini ein neues Bild für Folie 2 (Beschreibung aus eintrag.json, Feld bild_neu).
// Die Figur bleibt gleich durch Referenzbilder und eine feste Beschreibung; Claude prüft jedes Bild.
// Scheitert etwas, bleibt das Bibliotheksbild aus bild_folie2 und der Lauf geht normal weiter.
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const datum = process.argv[2];
if (!datum) throw new Error("Aufruf: node bild.mjs <datum>");
const eintragDatei = path.join(HIER, "..", "tagebuch", datum, "eintrag.json");
const e = JSON.parse(fs.readFileSync(eintragDatei, "utf8"));

const KEY = process.env.GEMINI_API_KEY;
const MODELL_BILD = process.env.MODELL_BILD || "gemini-nano-banana-2.1";
const MODELL_PRUEFEN = process.env.MODELL_PRUEFEN || "claude-sonnet-5-5";
const VERSUCHE = 2;

if (!KEY) { console.log("Kein GEMINI_API_KEY, nehme das Bibliotheksbild."); process.exit(0); }
if (!e.bild_neu) { console.log("Kein neues Bild gewünscht, nehme das Bibliotheksbild."); process.exit(0); }

const FIGUR = `Dieselbe Figur wie auf den Referenzbildern, exakt gleich gezeichnet: eine erwachsene Frau Mitte 20 aus Wien im Anime-Stil, normale erwachsene Proportionen, selbstbewusst.
Lange glatte schwarze Haare mit Pony und einer pinken Strähne, keine Zöpfe. Schwarze Spitzenbluse, Korsett-Weste, Faltenrock, zerrissene Strumpfhose, Plateaustiefel, pinkes Herz-Halsband.
Stil: sauberer Anime-Look wie auf den Referenzen, kräftige Linien, Goth-Farben Schwarz, Pink, Lavendel.
Verboten: Text, Buchstaben, Logos oder Wasserzeichen im Bild; fotorealistischer Stil; kindliches oder Chibi-Aussehen; sexualisierte Pose, Körperfokus oder knappe Kleidung; zusätzliche Personen; verformte Hände.
Hochformat, die Figur gut sichtbar im oberen und mittleren Bereich.`;

const referenzen = [
  path.join(HIER, "referenz", "referenz-sheet.jpg"),
  path.join(HIER, "bilder", "imbiss-semmel.jpg"),
  path.join(HIER, "bilder", "daumen-hoch.jpg"),
].filter((p) => fs.existsSync(p));
const alsBild = (p) => ({ data: fs.readFileSync(p).toString("base64"), mime: p.endsWith(".png") ? "image/png" : "image/jpeg" });

// Sucht in der Antwort den ersten Bildblock (die Interactions-API verschachtelt ihn je nach Ausgabe unterschiedlich)
function findeBild(o) {
  if (!o || typeof o !== "object") return null;
  if (typeof o.data === "string" && o.data.length > 1000 && (o.type === "image" || String(o.mime_type || o.mimeType).startsWith("image/")))
    return { data: o.data, mime: o.mime_type || o.mimeType || "image/png" };
  for (const v of Object.values(o)) { const b = findeBild(v); if (b) return b; }
  return null;
}

async function erzeuge(zusatz) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODELL_BILD,
      input: [
        { type: "text", text: `${FIGUR}\n\nSzene: ${e.bild_neu}${zusatz}` },
        ...referenzen.map(alsBild).map((b) => ({ type: "image", mime_type: b.mime, data: b.data })),
      ],
      response_format: { type: "image", aspect_ratio: "4:5", image_size: "1K" },
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Gemini: ${(Array.isArray(j) ? j[0] : j)?.error?.message || res.status}`);
  const bild = findeBild(j);
  if (!bild) throw new Error("Gemini hat kein Bild geliefert");
  return bild;
}

const client = new Anthropic();
const Pruefung = z.object({
  ok: z.boolean(),
  grund: z.string().describe("Kurz; bei Ablehnung konkret, was nicht stimmt"),
});

async function pruefe(bild) {
  const ref = alsBild(referenzen[0]);
  const res = await client.messages.parse({
    model: MODELL_PRUEFEN,
    max_tokens: 4000,
    system: "Du prüfst KI-Bilder für die Kunstfigur von Oida Leberkas, bevor sie veröffentlicht werden. Sei streng: lieber ablehnen als ein misslungenes Bild posten.",
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "Referenz der Figur:" },
        { type: "image", source: { type: "base64", media_type: ref.mime, data: ref.data } },
        { type: "text", text: "Neues Bild:" },
        { type: "image", source: { type: "base64", media_type: bild.mime, data: bild.data } },
        { type: "text", text: `Gewünschte Szene: ${e.bild_neu}\nPointe des Posts: ${e.folie2}\n\nLehne ab, wenn eines davon zutrifft:
- Es ist erkennbar nicht dieselbe Figur (Frisur, pinke Strähne, Outfit, Gesichtszüge, Stil).
- Typische KI-Fehler: verformte Hände oder Finger, verzerrtes Gesicht, doppelte oder fehlende Gliedmaßen, verschmolzene Gegenstände.
- Text, Buchstaben, Kauderwelsch-Schrift oder Wasserzeichen im Bild.
- Die Figur wirkt kindlich, oder das Bild ist sexualisiert (Pose, Körperfokus, knappe Kleidung).
- Fotorealistisch statt Anime-Stil.
- Die Szene passt nicht zur Beschreibung oder Leberkäse bzw. Semmel ist nicht erkennbar, obwohl verlangt.` },
      ],
    }],
    output_config: { format: zodOutputFormat(Pruefung), effort: "medium" },
  });
  if (!res.parsed_output) throw new Error("Bildprüfung ließ sich nicht lesen");
  return res.parsed_output;
}

let zusatz = "";
for (let v = 1; v <= VERSUCHE; v++) {
  try {
    const bild = await erzeuge(zusatz);
    const p = await pruefe(bild);
    console.log(`Bild-Versuch ${v}: ${p.ok ? "ok" : "abgelehnt"} (${p.grund})`);
    if (!p.ok) { zusatz = `\n\nDer letzte Versuch wurde abgelehnt: ${p.grund}. Vermeide das.`; continue; }
    const datei = `gen-${datum}.${bild.mime === "image/jpeg" ? "jpg" : "png"}`;
    fs.writeFileSync(path.join(HIER, "bilder", datei), Buffer.from(bild.data, "base64"));
    const bibDatei = path.join(HIER, "bibliothek.json");
    const bib = JSON.parse(fs.readFileSync(bibDatei, "utf8")).filter((b) => b.datei !== datei);
    bib.push({ datei, art: "szene", beschreibung: e.bild_neu });
    fs.writeFileSync(bibDatei, "[\n" + bib.map((b) => " " + JSON.stringify(b)).join(",\n") + "\n]\n");
    fs.writeFileSync(eintragDatei, JSON.stringify({ ...e, bild_folie2: datei, bild_ersatz: e.bild_folie2, bild_pruefung: p.grund }, null, 2) + "\n");
    console.log(`Neues Bild: ${datei}`);
    process.exit(0);
  } catch (err) {
    console.log(`Bild-Versuch ${v} fehlgeschlagen: ${err.message}`);
  }
}
console.log(`Kein brauchbares Bild, nehme ${e.bild_folie2} aus der Bibliothek.`);
