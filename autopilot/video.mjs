// Macht aus dem Post ein Reel: erst das Setup, dann erscheinen die neuen Teile nacheinander (schritt-NN.jpg aus render.mjs).
// Ergebnis: tagebuch/<id>/reel.mp4 (1080x1920) für Instagram-Reels und YouTube Shorts.
// Standard ist stumm (Dominik 18.10.2026). Mit der Repo-Variable STIMME="an" liest eine KI-Stimme jeden Teil vor
// und Untertitel laufen mit (untertitel.ass). Schlägt die Stimme fehl, bleibt das Reel stumm.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setupPointe } from "./eintrag.mjs";
import { STIMME_AN, tonspuren, dauerVon, sprechtext } from "./stimme.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const id = process.argv[2];
if (!id) throw new Error("Aufruf: node video.mjs <id>");
const ordner = path.join(HIER, "..", "tagebuch", id);
const i = JSON.parse(fs.readFileSync(path.join(ordner, "eintrag.json"), "utf8")).inhalt;

// Standzeit nach Textmenge: ca. 3,5 Wörter pro Sekunde plus 1 s Orientierung, mit Unter- und Obergrenze
const woerter = (s) => s.split(/\s+/).filter(Boolean).length;
const lesezeit = (s, min, max) => Math.min(max, Math.max(min, 1 + woerter(s) / 3.5));
function texte() {
  switch (i.format) {
    case "antwort": return [i.kommentar, i.zeilen.join(" ")];
    case "notiz": return [`${i.titel} ${i.absaetze.slice(0, -1).join(" ")}`, i.absaetze.at(-1)];
    case "bewertung": return [i.ort, i.text];
    case "szene": return [i.satz, i.klammern.join(" ")];
    case "mitteilungen": return [i.mitteilungen.slice(0, -1).map((m) => `${m.titel} ${m.text}`).join(" "), `${i.mitteilungen.at(-1).titel} ${i.mitteilungen.at(-1).text}`];
    case "termin": return [`${i.datum} ${i.titel} ${i.zeit}`, i.zeilen.join(" ")];
    case "wetter": return [`${i.ort} ${i.temperatur} ${i.lage}`, i.gefuehlt];
    case "umfrage": return [`${i.frage} ${i.optionen.map((x) => x.text).join(" ")}`, i.fuss];
    case "wiedergabe": return ["Gerade läuft", `${i.titel} ${i.kuenstler}`];
    case "sprachnachricht": return [i.name, i.transkript];
    case "suchverlauf": return [i.eingabe, i.vorschlaege.join(" ")];
    case "fehlermeldung": return [`${i.titel} ${i.text}`, `${i.knopf_links} ${i.knopf_rechts}`];
    case "todo": return [`${i.titel} ${i.punkte.map((p) => p.text).join(" ")}`, i.fazit];
    case "beleg": return [`${i.titel} ${i.posten.map((p) => `${p.name} ${p.menge}`).join(" ")}`, `${i.summe} ${i.fuss}`];
    case "chat": {
      // wie in formate.mjs: Setup bis zu Resis letzten Antworten
      const n = i.nachrichten.filter((m) => m.wer !== "zeit");
      let ende = n.length;
      while (ende > 1 && n[ende - 1].wer === "ich") ende--;
      return [n.slice(0, ende).map((m) => m.text).join(" "), n.slice(ende).map((m) => m.text).join(" ")];
    }
    default: return setupPointe(i);
  }
}
// Im Tagebuch-Ordner laufen, damit der Untertitel-Filter untertitel.ass ohne Pfad findet
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit", cwd: ordner });
const assZeit = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h}:${String(m).padStart(2, "0")}:${(s % 60).toFixed(2).padStart(5, "0")}`; };

// Bilder und Standzeiten: Setup, dann jeder neue Teil einzeln (schritte.json aus render.mjs). Ältere Einträge ohne Schritte: Setup, harter Schnitt, ganzer Post.
const [setupText, pointeText] = texte();
const schritteDatei = path.join(ordner, "schritte.json");
let bilder;
if (fs.existsSync(schritteDatei)) {
  const s = JSON.parse(fs.readFileSync(schritteDatei, "utf8"));
  bilder = s.map((x, n) => ({
    datei: x.datei,
    // schritte.json: Teil 0 ist das Setup, jeder weitere Teil ist der neue Text
    text: x.text,
    // Chat startet leer und füllt sich Blase für Blase, sonst steht das Setup lang genug zum Lesen
    dauer: n === 0 ? (["chat", "notiz"].includes(i.format) ? 1 : lesezeit(setupText, 2.5, 6)) : lesezeit(x.text, 1.6, 4) + (n === s.length - 1 ? 1.5 : 0),
  }));
} else {
  bilder = [
    { datei: "post-a.jpg", text: setupText, dauer: lesezeit(setupText, 2.5, 7) },
    { datei: "post.jpg", text: pointeText, dauer: lesezeit(pointeText, 3, 6) },
  ];
}

bilder.forEach((b) => { b.text = sprechtext(b.text); });

// Stimme: jeder Teil wird gesprochen, und der Teil bleibt so lang stehen, bis der Satz zu Ende ist
const VORLAUF = 0.15;
const NACHLAUF = 0.6;
let tonDaten = null;
if (STIMME_AN) {
  try {
    // Sprachspuren liegen im Arbeitsordner, nicht im Tagebuch (sonst würde das Eintragen sie mit committen)
    tonDaten = await tonspuren(bilder.map((b) => b.text), fs.mkdtempSync(path.join(os.tmpdir(), "stimme-")));
  } catch (e) {
    console.warn(`Stimme aus, Reel bleibt stumm: ${e.message}`);
    // Der Workflow macht daraus ein Issue für Dominik (Schritt „Stumm gepostet melden“)
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `stumm=${e.message.replace(/\s+/g, " ").slice(0, 200).replace(/[\r\n]/g, " ")}\n`);
  }
}
if (tonDaten) {
  bilder.forEach((b, k) => {
    if (!tonDaten[k]) return;
    b.ton = tonDaten[k];
    b.dauer = Math.max(b.dauer, VORLAUF + b.ton.dauer + NACHLAUF);
  });
}
// Jingle (optional): autopilot/assets/jingle.mp3, nur mit Repo-Variable JINGLE="an". Fehlt die Datei oder ist sie länger als 6 s, läuft das Reel ohne.
// JINGLE_POS="ende" (Standard, Dominik 19.10.2026) oder "anfang". Das Standbild steht so lange, wie der Jingle läuft; Jingle und Stimme überlappen nie.
const JINGLE_DATEI = path.join(HIER, "assets", "jingle.mp3");
let jingle = null;
if (process.env.JINGLE === "an" && fs.existsSync(JINGLE_DATEI)) {
  try {
    const laenge = dauerVon(JINGLE_DATEI);
    if (laenge > 6) throw new Error(`${laenge.toFixed(1)} s, höchstens 6 s erlaubt`);
    jingle = { datei: JINGLE_DATEI, dauer: Number(laenge.toFixed(1)), start: 0 };
  } catch (e) {
    console.warn(`Jingle aus, Reel ohne Jingle: ${e.message}`);
  }
}
if (jingle) {
  if (process.env.JINGLE_POS === "anfang") {
    bilder.unshift({ datei: bilder[0].datei, dauer: jingle.dauer });
  } else {
    jingle.start = bilder.reduce((a, b) => a + b.dauer, 0);
    bilder.push({ datei: bilder.at(-1).datei, dauer: jingle.dauer });
  }
}
bilder.forEach((b) => { b.dauer = Number(b.dauer.toFixed(1)); });
const DAUER = Number(bilder.reduce((a, b) => a + b.dauer, 0).toFixed(1));
console.log(`${bilder.length} Bilder, gesamt ${DAUER} s${tonDaten ? ", mit Stimme" : ""}`);

// Startzeit jedes Teils im Reel; danach Sprachspur und Untertitel dazu
let start = 0;
for (const b of bilder) { b.start = start; start += b.dauer; }
const sprecher = bilder.filter((b) => b.ton);
if (sprecher.length) {
  // Untertitel als ASS mit 1080x1920 als Bezug, damit Größe und Rand stimmen (SRT skalierte zu groß)
  const kopf = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Unter,Inter,44,&H00FFFFFF,&H000000FF,&H00000000,&H99120A10,-1,0,0,0,100,100,0,0,3,14,0,2,90,90,230,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const zeilen = sprecher.map((b) => {
    const von = b.start + VORLAUF;
    const text = b.text.replace(/\s+/g, " ").replace(/[{}\\]/g, "").trim();
    return `Dialogue: 0,${assZeit(von)},${assZeit(von + b.ton.dauer)},Unter,,0,0,0,,${text}`;
  });
  fs.writeFileSync(path.join(ordner, "untertitel.ass"), kopf + zeilen.join("\n") + "\n");
}

// Alle Bilder hochkant auf dunklem Grund, ohne Bewegung; harte Schnitte von Teil zu Teil
const stufe = (n) => `[${n}:v]scale=1080:-2,fps=30,pad=1080:1920:0:285:color=0x0D090C,setsar=1[v${n}]`;
const n = bilder.length;
const bildEingaben = bilder.flatMap((b) => ["-loop", "1", "-t", String(b.dauer), "-i", path.join(ordner, b.datei)]);
const bildFilter = `${bilder.map((_, k) => stufe(k)).join(";")};${bilder.map((_, k) => `[v${k}]`).join("")}concat=n=${n}:v=1:a=0[v]`;
const untertitel = sprecher.length
  ? ";[v]subtitles=untertitel.ass:fontsdir=../../assets/fonts[vs]"
  : "";

// Alle Tonspuren (Stimmteile und ggf. Jingle) auf ihren Startpunkt legen, dann zusammenmischen (die Teile überlappen nicht)
const spuren = [
  ...sprecher.map((b) => ({ datei: b.ton.wav, start: b.start + VORLAUF })),
  ...(jingle ? [{ datei: jingle.datei, start: jingle.start, jingle: true }] : []),
];
let tonEingaben = [];
let tonFilter = "";
if (spuren.length) {
  tonEingaben = spuren.flatMap((s) => ["-i", s.datei]);
  tonFilter = `${spuren.map((s, j) => `[${n + j}:a]${s.jingle ? "loudnorm=I=-16:TP=-1.5:LRA=11," : ""}adelay=${Math.round(s.start * 1000)}:all=1,apad=whole_dur=${DAUER}[a${j}]`).join(";")};${spuren.map((_, j) => `[a${j}]`).join("")}amix=inputs=${spuren.length}:duration=first:normalize=0[aus]`;
}
const stilleTonspur = spuren.length ? [] : ["-f", "lavfi", "-t", String(DAUER), "-i", "anullsrc=r=44100:cl=stereo"];
const tonAbbildung = spuren.length ? "[aus]" : `${n}:a`;

ff([
  ...bildEingaben, ...tonEingaben, ...stilleTonspur,
  "-filter_complex", `${bildFilter}${untertitel}${tonFilter ? `;${tonFilter}` : ""}`,
  "-map", sprecher.length ? "[vs]" : "[v]", "-map", tonAbbildung,
  "-c:v", "libx264", "-preset", "medium", "-crf", "26", "-pix_fmt", "yuv420p", "-r", "30",
  "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-movflags", "+faststart", path.join(ordner, "reel.mp4"),
]);

const tonText = [sprecher.length && "mit Stimme und Untertiteln", jingle && "mit Jingle"].filter(Boolean);
console.log(`Reel fertig (${tonText.length ? tonText.join(", ") : "ohne Ton"})`);
