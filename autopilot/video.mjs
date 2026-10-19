// Macht aus dem Post ein Reel ohne Ton: erst das Setup, dann erscheinen die neuen Teile nacheinander (schritt-NN.jpg aus render.mjs).
// Ergebnis: tagebuch/<id>/reel.mp4 (1080x1920) für Instagram-Reels und YouTube Shorts.
// Die Tonspur ist stumm (Dominik 18.10.2026: Reels ganz ohne Ton); sie bleibt drin, weil manche Plattformen eine erwarten.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { setupPointe } from "./eintrag.mjs";

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
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

// Bilder und Standzeiten: Setup, dann jeder neue Teil einzeln (schritte.json aus render.mjs). Ältere Einträge ohne Schritte: Setup, harter Schnitt, ganzer Post.
const [setupText, pointeText] = texte();
const schritteDatei = path.join(ordner, "schritte.json");
let bilder;
if (fs.existsSync(schritteDatei)) {
  const s = JSON.parse(fs.readFileSync(schritteDatei, "utf8"));
  bilder = s.map((x, n) => ({
    datei: x.datei,
    // Chat startet leer und füllt sich Blase für Blase, sonst steht das Setup lang genug zum Lesen
    dauer: n === 0 ? (["chat", "notiz"].includes(i.format) ? 1 : lesezeit(setupText, 2.5, 6)) : lesezeit(x.text, 1.6, 4) + (n === s.length - 1 ? 1.5 : 0),
  }));
} else {
  bilder = [{ datei: "post-a.jpg", dauer: lesezeit(setupText, 2.5, 7) }, { datei: "post.jpg", dauer: lesezeit(pointeText, 3, 6) }];
}
bilder.forEach((b) => { b.dauer = Number(b.dauer.toFixed(1)); });
const DAUER = Number(bilder.reduce((a, b) => a + b.dauer, 0).toFixed(1));
console.log(`${bilder.length} Bilder, gesamt ${DAUER} s`);

// Alle Bilder hochkant auf dunklem Grund, ohne Bewegung; harte Schnitte von Teil zu Teil
const stufe = (n) => `[${n}:v]scale=1080:-2,fps=30,pad=1080:1920:0:285:color=0x0D090C,setsar=1[v${n}]`;
const n = bilder.length;
ff([...bilder.flatMap((b) => ["-loop", "1", "-t", String(b.dauer), "-i", path.join(ordner, b.datei)]), "-f", "lavfi", "-t", String(DAUER), "-i", "anullsrc=r=44100:cl=stereo",
  "-filter_complex", `${bilder.map((_, k) => stufe(k)).join(";")};${bilder.map((_, k) => `[v${k}]`).join("")}concat=n=${n}:v=1:a=0[v]`,
  "-map", "[v]", "-map", `${n}:a`, "-c:v", "libx264", "-preset", "medium", "-crf", "26", "-pix_fmt", "yuv420p", "-r", "30",
  "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-movflags", "+faststart", path.join(ordner, "reel.mp4")]);

console.log("Reel fertig (ohne Ton)");
