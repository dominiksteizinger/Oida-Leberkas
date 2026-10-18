// Macht aus den zwei Folien Videos mit Musik:
// - tagebuch/<datum>/folie-1.mp4 und folie-2.mp4 (1080x1350) für das Instagram-Karussell, die Musik läuft über beide Folien weiter
// - <ausgabe>/reel.mp4 (1080x1920) für Reels, Shorts und TikTok; wird nicht ins Repo eingecheckt
// Ohne Musik in der Bibliothek passiert nichts, dann bleibt das Karussell bei Bildern.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const WURZEL = path.join(HIER, "..");
const [datum, ausgabe = path.join(WURZEL, "tagebuch", datum)] = process.argv.slice(2);
if (!datum) throw new Error("Aufruf: node video.mjs <datum> [ordner für reel.mp4]");
const ordner = path.join(WURZEL, "tagebuch", datum);
const e = JSON.parse(fs.readFileSync(path.join(ordner, "eintrag.json"), "utf8"));
const musik = JSON.parse(fs.readFileSync(path.join(HIER, "musik.json"), "utf8"));
if (!musik.length) {
  console.log("Keine Musik in musik.json, Videos werden übersprungen.");
  process.exit(0);
}
const track = musik.find((m) => m.datei === e.musik) || musik[[...datum].reduce((a, c) => a + c.charCodeAt(0), 0) % musik.length];
const audio = path.join(HIER, "musik", track.datei);
const F1 = path.join(ordner, "folie-1.jpg");
const F2 = path.join(ordner, "folie-2.jpg");
const DAUER = 6;
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
const video = ["-c:v", "libx264", "-preset", "medium", "-tune", "stillimage", "-crf", "26", "-pix_fmt", "yuv420p", "-r", "30"];
const ton = ["-c:a", "aac", "-b:a", "128k", "-ar", "44100"];

// Karussell: Folie 1 bekommt Sekunde 0 bis 6 des Tracks, Folie 2 Sekunde 6 bis 12 mit Ausblenden
for (const [n, bild, start] of [[1, F1, 0], [2, F2, DAUER]]) {
  const aus = n === 2 ? `,afade=t=out:st=${DAUER - 1.5}:d=1.5` : "";
  ff(["-loop", "1", "-i", bild, "-ss", String(start), "-i", audio, "-t", String(DAUER),
    "-af", `afade=t=in:st=0:d=${n === 1 ? 1 : 0.3}${aus}`, ...video, ...ton, "-shortest", "-movflags", "+faststart",
    path.join(ordner, `folie-${n}.mp4`)]);
}

// Reel: beide Folien hochkant auf dunklem Grund, langsamer Zoom, weiche Überblendung.
// Die Bilder gehen als Einzelbild hinein; zoompan erzeugt daraus selbst DAUER*30 Frames.
fs.mkdirSync(ausgabe, { recursive: true });
const zoom = (i) => `[${i}:v]scale=1080:-2,zoompan=z='min(zoom+0.0004,1.05)':d=${DAUER * 30}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350:fps=30,pad=1080:1920:0:285:color=0x0D090C,setsar=1[v${i}]`;
ff(["-i", F1, "-i", F2, "-i", audio,
  "-filter_complex", `${zoom(0)};${zoom(1)};[v0][v1]xfade=transition=fade:duration=0.6:offset=${DAUER - 0.6}[v];[2:a]atrim=0:${2 * DAUER - 0.6},afade=t=in:d=1,afade=t=out:st=${2 * DAUER - 2.1}:d=1.5[a]`,
  "-map", "[v]", "-map", "[a]", ...video, ...ton, "-movflags", "+faststart", path.join(ausgabe, "reel.mp4")]);

console.log(`Videos fertig mit „${track.titel}“ (${track.datei})`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `musik=${track.titel}\n`);
