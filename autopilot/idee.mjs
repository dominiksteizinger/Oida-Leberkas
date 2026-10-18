// Erzeugt den Tageseintrag: Claude schreibt das Karussell, ein zweiter Lauf prüft es gegen die Regeln.
// Ergebnis: tagebuch/<datum>/eintrag.json
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const WURZEL = path.join(HIER, "..");
const MODELL_SCHREIBEN = process.env.MODELL_SCHREIBEN || "claude-haiku-5-5";
const MODELL_PRUEFEN = process.env.MODELL_PRUEFEN || "claude-sonnet-5-5";
const VERSUCHE = 5;

const lies = (p) => fs.readFileSync(path.join(HIER, p), "utf8");
const regeln = lies("regeln.md");
const humor = lies("wissen/humor.md");
const goth = lies("wissen/dark-goth-humor.md");
const beispiele = lies("beispiele.md");
const bibliothek = JSON.parse(lies("bibliothek.json"));
const musik = JSON.parse(lies("musik.json"));
const eintraegeDatei = path.join(WURZEL, "tagebuch", "eintraege.json");
const bisher = fs.existsSync(eintraegeDatei) ? JSON.parse(fs.readFileSync(eintraegeDatei, "utf8")) : [];

const jetzt = new Date();
const datum = process.env.DATUM || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(jetzt);
const wochentag = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", weekday: "long" }).format(new Date(datum + "T12:00:00"));

async function wetterWien() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=48.21&longitude=16.37&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FVienna&forecast_days=1";
    const d = (await (await fetch(url)).json()).daily;
    const code = d.weather_code[0];
    const art = code === 0 ? "klar und sonnig" : code <= 3 ? "bewölkt" : code <= 48 ? "neblig" : code <= 67 ? "Regen" : code <= 77 ? "Schnee" : code <= 82 ? "Regenschauer" : "Gewitter";
    return `${art}, ${Math.round(d.temperature_2m_min[0])} bis ${Math.round(d.temperature_2m_max[0])} Grad, ${d.precipitation_sum[0]} mm Niederschlag`;
  } catch {
    return "unbekannt";
  }
}

function ausDatei(variable) {
  const datei = process.env[variable];
  if (!datei || !fs.existsSync(datei)) return [];
  return JSON.parse(fs.readFileSync(datei, "utf8"));
}

// Von Dominik bewertete Einträge (Issues mit Label gut/schlecht); seine Kommentare sind die Begründung
function bewertungen() {
  const liste = ausDatei("BEWERTUNGEN_DATEI");
  const zeile = (b) => `- ${b.text.trim()}${b.kommentare ? `\n  Dominik: ${b.kommentare}` : ""}`;
  const gut = liste.filter((b) => b.urteil === "gut").map(zeile);
  const schlecht = liste.filter((b) => b.urteil === "schlecht").map(zeile);
  if (!gut.length && !schlecht.length) return "";
  return `\n\n# Von Dominik bewertete Einträge\n\n## Gut\n\n${gut.join("\n") || "(noch keine)"}\n\n## Schlecht\n\n${schlecht.join("\n") || "(noch keine)"}`;
}

const Eintrag = z.object({
  folie1: z.string().describe("Melancholischer Satz für Folie 1, höchstens 140 Zeichen"),
  folie2: z.string().describe("Cuter Leberkas-Twist für Folie 2, höchstens 80 Zeichen"),
  bild_folie1: z.string().describe("Dateiname einer Szene aus der Bibliothek als Hintergrund für Folie 1"),
  bild_folie2: z.string().describe("Dateiname eines Bildes aus der Bibliothek für Folie 2, passend zum Twist (Ersatz, falls kein neues Bild entsteht)"),
  bild_neu: z.string().nullable().describe("Neues Bild für Folie 2, das genau diesen Twist zeigt: Ort, Licht, was sie tut, wie Leberkäse oder Semmel vorkommt, ihr Gesichtsausdruck. Nur Szene und Handlung, nie ihr Aussehen oder ihre Kleidung, kein Text im Bild. null, wenn ein Bibliotheksbild perfekt passt."),
  caption: z.string().describe("Caption in ihrer Stimme, ohne Hashtags und ohne Aufforderung"),
  aufforderung: z.string().describe("Ein Satz, der zum Mitmachen einlädt (Frage an die Community, Speichern, Teilen), in ihrer Stimme"),
  hashtags: z.array(z.string()).describe("3 bis 6 Hashtags mit #"),
  musik: z.string().nullable().describe("Dateiname des Tracks aus der Musikliste, der zur Stimmung passt; null, wenn die Liste leer ist"),
  idee_nummer: z.number().nullable().describe("Nummer der verwendeten Idee aus der Inbox, sonst null"),
});

const Pruefung = z.object({
  ok: z.boolean(),
  grund: z.string().describe("Kurze Begründung; bei Ablehnung konkret, was gegen welche Regel verstößt oder nicht lustig ist"),
});

const client = new Anthropic();

async function frage(modell, system, text, format, effort) {
  const res = await client.messages.parse({
    model: modell,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: text }],
    output_config: { format: zodOutputFormat(format), effort },
  });
  if (res.stop_reason === "refusal") throw new Error("Modell hat abgelehnt");
  if (!res.parsed_output) throw new Error("Antwort ließ sich nicht lesen");
  return res.parsed_output;
}

function pruefeFormal(e) {
  const fehler = [];
  const dateien = new Set(bibliothek.map((b) => b.datei));
  const szenen = new Set(bibliothek.filter((b) => b.art === "szene").map((b) => b.datei));
  if (e.folie1.length > 160) fehler.push("Folie 1 ist zu lang");
  if (e.folie2.length > 90) fehler.push("Folie 2 ist zu lang");
  if (!szenen.has(e.bild_folie1)) fehler.push(`bild_folie1 "${e.bild_folie1}" ist keine Szene aus der Bibliothek`);
  if (!dateien.has(e.bild_folie2)) fehler.push(`bild_folie2 "${e.bild_folie2}" gibt es nicht`);
  if (e.bild_folie1 === e.bild_folie2) fehler.push("Folie 1 und 2 brauchen verschiedene Bilder");
  if (musik.length && !musik.some((m) => m.datei === e.musik)) fehler.push(`musik "${e.musik}" gibt es nicht`);
  return fehler;
}

const wetter = await wetterWien();
const ideen = ausDatei("IDEEN_DATEI");
const bewertet = bewertungen();
const letzte = bisher.slice(0, 30).map((e) => `- ${e.datum}: „${e.folie1}“ / „${e.folie2}“ (Bilder: ${e.bild_folie1}, ${e.bild_folie2})`).join("\n") || "(noch keine)";

const systemSchreiben = `Du schreibst jeden Tag einen Instagram-Karussell-Post für die Kunstfigur von Oida Leberkas.\n\n${regeln}\n\n# Beispiele\n\n${beispiele}${bewertet}\n\n# Wissensbasis Dark-Goth-Humor (der Kern des Tons)\n\n${goth}\n\n# Wissensbasis österreichischer Humor (nur Hintergrund; Dialekt-Beispiele dort nicht übernehmen, wir schreiben Hochdeutsch)\n\n${humor}`;
const systemPruefen = `Du bist die Qualitätsprüfung für Posts von Oida Leberkas. Du lehnst nur in drei Fällen ab:\n1. Grenzverletzung: Sexualisierung, Körperfokus, Flirt- oder Beziehungsrahmung, Verfügbarkeits- oder Besitzbotschaften, kindliche Darstellung, Witze über reale Gruppen, Krankheit oder Suizid.\n2. Wiederholung: Motiv, Pointe oder Formulierung kommt aus den letzten Einträgen oder einem Beispiel aus den Regeln fast wörtlich vor.\n3. Spoiler: Die Caption erklärt oder verrät die Pointe von Folie 2.\n„Nicht lustig genug“, zahm oder vorhersehbar allein reicht NICHT für eine Ablehnung. Wenn keiner der drei Fälle zutrifft, gib ok.\n\n${regeln}\n\n# Beispiele\n\n${beispiele}${bewertet}`;

let auftrag = `Heute ist ${wochentag}, der ${datum}. Wetter in Wien: ${wetter}.

Bildbibliothek (nur diese Dateinamen verwenden; Folie 1 braucht eine Szene):
${bibliothek.map((b) => `- ${b.datei} (${b.art}): ${b.beschreibung}`).join("\n")}

Musik (einen Track passend zur Stimmung wählen):
${musik.map((m) => `- ${m.datei}: ${m.stimmung}`).join("\n") || "(keine)"}

Letzte Einträge (nicht wiederholen):
${letzte}

${ideen.length ? `Ideen aus der Inbox (eine davon darfst du aufgreifen und in unsere Welt übersetzen, nie kopieren):\n${ideen.map((i) => `${i.nummer}. ${i.text}`).join("\n")}` : "Keine Ideen in der Inbox."}

Schreib den heutigen Eintrag.`;

let eintrag, pruefung;
for (let v = 1; v <= VERSUCHE; v++) {
  eintrag = await frage(MODELL_SCHREIBEN, systemSchreiben, auftrag, Eintrag, "high");
  const formal = pruefeFormal(eintrag);
  pruefung = formal.length
    ? { ok: false, grund: formal.join("; ") }
    : await frage(MODELL_PRUEFEN, systemPruefen, `Letzte Einträge:\n${letzte}\n\nNeuer Eintrag:\n${JSON.stringify(eintrag, null, 2)}`, Pruefung, "medium");
  console.log(`Versuch ${v}: ${pruefung.ok ? "ok" : "abgelehnt"} (${pruefung.grund})`);
  if (pruefung.ok) break;
  auftrag += `\n\nDein letzter Vorschlag wurde abgelehnt:\n${JSON.stringify(eintrag)}\nGrund: ${pruefung.grund}\nSchreib einen ganz neuen Eintrag mit anderem Motiv und anderen Formulierungen, nicht nur eine Variante.`;
}
if (!pruefung.ok) {
  console.error("Kein Eintrag hat die Prüfung bestanden, heute wird nichts erzeugt.");
  process.exit(1);
}

const ordner = path.join(WURZEL, "tagebuch", datum);
fs.mkdirSync(ordner, { recursive: true });
const ergebnis = { datum, ...eintrag, wetter, modell: MODELL_SCHREIBEN, pruefung: pruefung.grund };
fs.writeFileSync(path.join(ordner, "eintrag.json"), JSON.stringify(ergebnis, null, 2) + "\n");
console.log(`Folie 1: ${eintrag.folie1}\nFolie 2: ${eintrag.folie2}\nCaption: ${eintrag.caption}\n${eintrag.aufforderung}\n${eintrag.hashtags.join(" ")}`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `datum=${datum}\nidee=${eintrag.idee_nummer ?? ""}\n`);
