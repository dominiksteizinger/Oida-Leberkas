// KI-Stimme für die Reels: Gemini-TTS über GEMINI_API_KEY (Free-Tier, kostet nichts).
// Schaltbar über die Repo-Variable STIMME ("an" = Stimme an; sonst bleibt das Reel stumm).
// STIMME_STIL wählt die Stimmlage: "trocken" (Standard) oder "muede" (Vergleich).
// Fällt die Stimme aus (Fehler, Kontingent, kein Schlüssel), läuft das Reel stumm weiter; das Posten hängt nicht daran.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

export const STIMME_AN = process.env.STIMME === "an";

// Erstes Modell, das der Schlüssel kennt, gewinnt (404 = Modell unbekannt, dann das nächste)
const MODELLE = [process.env.STIMME_MODELL, "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"].filter(Boolean);

// Vorgegebene weibliche Gemini-Stimmen, keine echten Personen. Kore: fest, sachlich. Callirrhoe: locker, müde.
// Gesprochen wird nur der Reel-Text. Stilanweisungen als Präfix würden mitgesprochen (Probe 19.10.), deshalb hat die Stimme den Ton.
const STIMMLAGEN = {
  trocken: { stimme: "Kore" },
  muede: { stimme: "Callirrhoe" },
};

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

// Einen Text sprechen: schreibt <ziel>.wav (44,1 kHz Stereo) und gibt die Dauer in Sekunden zurück
export async function sprechen(text, ziel, stil = "trocken") {
  const schluessel = process.env.GEMINI_API_KEY;
  if (!schluessel) throw new Error("GEMINI_API_KEY fehlt");
  const { stimme } = STIMMLAGEN[stil] ?? STIMMLAGEN.trocken;
  for (const modell of MODELLE) {
    const antwort = await anfrage(modell, stimme, text, schluessel);
    if (antwort.status === 404) continue;
    if (!antwort.ok) throw new Error(`Gemini-TTS ${modell}: ${antwort.status} ${(await antwort.text()).slice(0, 300)}`);
    const daten = await antwort.json();
    const teil = daten.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!teil) throw new Error(`Gemini-TTS ${modell} lieferte kein Audio`);
    // Rohes PCM, Abtastrate steht im mimeType (sonst 24 kHz, Standard von Gemini-TTS)
    const rate = /rate=(\d+)/.exec(teil.inlineData.mimeType || "")?.[1] ?? "24000";
    console.log(`TTS ${modell}: ${teil.inlineData.mimeType || "ohne mimeType"}, ${Buffer.from(teil.inlineData.data, "base64").length} Bytes`);
    fs.writeFileSync(`${ziel}.pcm`, Buffer.from(teil.inlineData.data, "base64"));
    // Aufbereitung je Satz: Rumpel und Zischen über 11 kHz raus, leichte Rauschminderung,
    // 30 ms Ein- und Ausblenden gegen Knackser an den Satzgrenzen, dann gleichmäßige Lautheit
    ff(["-f", "s16le", "-ar", rate, "-ac", "1", "-i", `${ziel}.pcm`, "-af", AUFBEREITUNG, "-ar", "44100", "-ac", "2", `${ziel}.wav`]);
    fs.rmSync(`${ziel}.pcm`);
    return dauerVon(`${ziel}.wav`);
  }
  throw new Error(`Kein TTS-Modell verfügbar (${MODELLE.join(", ")})`);
}

// Für jeden Bildteil die Sprachspur: { wav, dauer } oder null, wenn der Teil keinen Text hat
export async function tonspuren(texte, ordner) {
  const stil = process.env.STIMME_STIL || "muede";
  const ergebnis = [];
  for (const [k, text] of texte.entries()) {
    if (!text || !text.trim()) { ergebnis.push(null); continue; }
    const ziel = `${ordner}/ton-${String(k).padStart(2, "0")}`;
    ergebnis.push({ wav: `${ziel}.wav`, dauer: await sprechen(text, ziel, stil) });
  }
  return ergebnis;
}
