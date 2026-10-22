// KI-Stimme für die Reels: Gemini-TTS über GEMINI_API_KEY (Free-Tier, kostet nichts).
// Schaltbar über die Repo-Variable STIMME ("an" = Stimme an; sonst bleibt das Reel stumm).
// STIMME_STIL wählt die Stimmlage (siehe STIMMLAGEN, in den Workflows aus der Repo-Variable STIMME_LAGE), STIMME_TEMPO das Sprechtempo.
// Fällt die Stimme aus (Fehler, Kontingent, kein Schlüssel), läuft das Reel stumm weiter; das Posten hängt nicht daran.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

// Satz-Cache: gesprochener Rohton je Stimme und Text, als Opus im Repo. Gleicher Satz = gleiche Stimme, ohne neuen API-Aufruf.
const CACHE = path.join(path.dirname(new URL(import.meta.url).pathname), "stimme-cache");

export const STIMME_AN = process.env.STIMME === "an";

// Erstes Modell, das der Schlüssel kennt, gewinnt (404 = Modell unbekannt, dann das nächste)
const MODELLE = [process.env.STIMME_MODELL, "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"].filter(Boolean);

// Vorgegebene weibliche Gemini-Stimmen, keine echten Personen. Leda: jung, natürlich (Standard seit 22.10.2026, Dominiks Wahl aus der Probe
// gegen Callirrhoe, Aoede, Despina, Laomedeia). Callirrhoe: müde (bis 22.10.). Kore: fest, sachlich.
// Stilanweisungen gehen nicht: im Text werden sie mitgesprochen (Proben 19. und 22.10., bis 25 s Anweisung bei kurzen Sätzen),
// als systemInstruction liefert das TTS-Modell kein Audio. Den Ton bestimmt deshalb allein die Stimme.
const STIMMLAGEN = {
  leda: { stimme: "Leda" },
  muede: { stimme: "Callirrhoe" },
  trocken: { stimme: "Kore" },
};
const STANDARD = "leda";
const lage = (stil) => STIMMLAGEN[stil] ?? STIMMLAGEN[STANDARD];
const cacheDatei = ({ stimme }, text) => path.join(CACHE, `${crypto.createHash("sha1").update(`${stimme}\n${text}`).digest("hex")}.opus`);

// Tempo (Dominik 22.10.2026: zu langsam). STIMME_TEMPO staucht die fertige Spur ohne Tonhöhenänderung, 1 = Original, Standard 1.15.
const TEMPO = Number(process.env.STIMME_TEMPO || 1.15);
// Aufbereitung der Rohspur (siehe sprechen): Stille am Anfang und Ende weg, Pausen im Satz auf höchstens 0,3 s kürzen, dann Tempo
const AUFBEREITUNG = [
  "silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration=0.3:stop_threshold=-45dB:stop_silence=0.18",
  TEMPO !== 1 && `atempo=${TEMPO}`,
  "highpass=f=80,equalizer=f=4000:t=q:w=1.2:g=1.5,afade=t=in:d=0.03,areverse,afade=t=in:d=0.03,areverse,loudnorm=I=-16:TP=-1.5:LRA=11",
].filter(Boolean).join(",");

// Gesprochen wird nur der Inhalt: Datum und Uhrzeit der Notizen-Oberfläche (ändern sich je Tag, der Satz-Cache träfe nie) und das Menü fallen weg
export const sprechtext = (text) => String(text)
  .replace(/\d{1,2}\. \p{L}+ \d{4} um \d{2}:\d{2}/u, "")
  .replace(/^‹ Notizen Fertig\s*/, "")
  .replace(/\s+/g, " ")
  .trim();

const erschoepft = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

export function dauerVon(datei) {
  return Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", datei]).toString().trim());
}

async function anfrage(modell, stimme, text, schluessel) {
  for (let versuch = 1; ; versuch++) {
    const antwort = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modell}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": schluessel },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: stimme } } } },
      }),
    });
    // Free-Tier-Limit: kurz warten und noch zweimal versuchen
    if (antwort.status === 429 && versuch < 3) { await sleep(20000 * versuch); continue; }
    return antwort;
  }
}

// Einen Text sprechen: holt den Rohton aus dem Cache oder von Gemini, bereitet ihn auf und schreibt <ziel>.wav (44,1 kHz Stereo).
// Gibt die Dauer in Sekunden zurück.
export async function sprechen(text, ziel, stil = STANDARD) {
  const l = lage(stil);
  const roh = cacheDatei(l, text);
  if (!fs.existsSync(roh)) {
    await holeVonGemini(text, l, roh);
  }
  ff(["-i", roh, "-af", AUFBEREITUNG, "-ar", "44100", "-ac", "2", `${ziel}.wav`]);
  return dauerVon(`${ziel}.wav`);
}

// Satz vorab in den Cache legen, ohne ihn aufzubereiten. Gibt false zurück, wenn er schon drin war.
export async function vorfuellen(text, stil = STANDARD) {
  const l = lage(stil);
  const roh = cacheDatei(l, text);
  if (fs.existsSync(roh)) return false;
  await holeVonGemini(text, l, roh);
  return true;
}

export const imCache = (text, stil = STANDARD) => fs.existsSync(cacheDatei(lage(stil), text));

// Gemini ruft nur auf, wenn der Satz noch nicht im Cache liegt
async function holeVonGemini(text, { stimme }, roh) {
  const schluessel = process.env.GEMINI_API_KEY;
  if (!schluessel) throw new Error("GEMINI_API_KEY fehlt, und der Satz ist nicht im Cache");
  modelle: for (const modell of MODELLE) {
    if (erschoepft.has(modell)) continue;
    for (let versuch = 1; versuch <= 3; versuch++) {
      const antwort = await anfrage(modell, stimme, text, schluessel);
      if (antwort.status === 404) continue modelle;
      // Kontingent des Modells aufgebraucht (nach den Wiederholungen in anfrage): in diesem Lauf nicht mehr versuchen, das nächste Modell hat ein eigenes Kontingent
      if (antwort.status === 429) { erschoepft.add(modell); console.warn(`Gemini-TTS ${modell}: Kontingent aufgebraucht, nächstes Modell`); continue modelle; }
      if (!antwort.ok) throw new Error(`Gemini-TTS ${modell}: ${antwort.status} ${(await antwort.text()).slice(0, 300)}`);
      const daten = await antwort.json();
      const teil = daten.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!teil) throw new Error(`Gemini-TTS ${modell} lieferte kein Audio`);
      // Gemini liefert je nach Lauf WAV mit Kopf oder rohes PCM. Am Kopf erkennen, sonst als 16-Bit-PCM lesen
      const daten64 = Buffer.from(teil.inlineData.data, "base64");
      const rate = /rate=(\d+)/.exec(teil.inlineData.mimeType || "")?.[1] ?? "24000";
      fs.mkdirSync(CACHE, { recursive: true });
      const tmp = `${roh}.tmp`;
      fs.writeFileSync(tmp, daten64);
      const eingabe = daten64.subarray(0, 4).toString("ascii") === "RIFF"
        ? ["-i", tmp]
        : ["-f", "s16le", "-ar", rate, "-ac", "1", "-i", tmp];
      ff([...eingabe, "-ac", "1", "-c:a", "libopus", "-b:a", "48k", roh]);
      fs.rmSync(tmp);
      // Plausibel sind höchstens 2 s plus 1 s je 6 Zeichen. Länger heißt: das Modell hat mehr gesprochen als den Text (Probe 22.10.)
      const dauer = dauerVon(roh);
      if (dauer > 2 + text.length / 6) {
        fs.rmSync(roh);
        console.warn(`Gemini ${modell}: ${dauer.toFixed(1)} s für ${text.length} Zeichen verworfen (Versuch ${versuch})`);
        continue;
      }
      console.log(`Gemini ${modell}: neuer Satz im Cache (${path.basename(roh)}, ${stimme}, ${dauer.toFixed(1)} s, ${(text.length / dauer).toFixed(1)} Zeichen/s)`);
      return;
    }
    throw new Error(`Gemini-TTS ${modell}: Tonspur dreimal zu lang für „${text.slice(0, 40)}“`);
  }
  throw new Error(`Kein TTS-Modell verfügbar oder Tageskontingent aufgebraucht (${MODELLE.join(", ")}), HTTP 429`);
}

// Für jeden Bildteil die Sprachspur: { wav, dauer } oder null, wenn der Teil keinen Text hat
export async function tonspuren(texte, ordner) {
  const stil = process.env.STIMME_STIL || STANDARD;
  const ergebnis = [];
  for (const [k, text] of texte.entries()) {
    if (!text || !text.trim()) { ergebnis.push(null); continue; }
    const ziel = `${ordner}/ton-${String(k).padStart(2, "0")}`;
    ergebnis.push({ wav: `${ziel}.wav`, dauer: await sprechen(text, ziel, stil) });
  }
  return ergebnis;
}
