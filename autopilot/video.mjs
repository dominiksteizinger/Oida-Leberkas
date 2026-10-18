// Macht aus dem Post ein Reel mit Musik: erst das Setup (post-a.jpg), nach einer Pause der ganze Post (post.jpg).
// Ergebnis: tagebuch/<id>/reel.mp4 (1080x1920) für Instagram-Reels und YouTube Shorts.
// Ohne Musik in musik.json passiert nichts, dann wird nur das Bild gepostet.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const id = process.argv[2];
if (!id) throw new Error("Aufruf: node video.mjs <id>");
const ordner = path.join(HIER, "..", "tagebuch", id);
const e = JSON.parse(fs.readFileSync(path.join(ordner, "eintrag.json"), "utf8"));
const musik = JSON.parse(fs.readFileSync(path.join(HIER, "musik.json"), "utf8"));
if (!musik.length) {
  console.log("Keine Musik in musik.json, kein Reel.");
  process.exit(0);
}
const track = musik.find((m) => m.datei === e.musik) || musik[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % musik.length];
const audio = path.join(HIER, "musik", track.datei);
const SETUP = 2.8;
const DAUER = 8;
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

// Beide Stufen hochkant auf dunklem Grund mit leichtem Zoom; harter Schnitt von Setup auf Pointe
const stufe = (n, d) => `[${n}:v]scale=1080:-2,zoompan=z='min(zoom+0.0003,1.04)':d=${Math.round(d * 30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350:fps=30,pad=1080:1920:0:285:color=0x0D090C,setsar=1[v${n}]`;
ff(["-i", path.join(ordner, "post-a.jpg"), "-i", path.join(ordner, "post.jpg"), "-i", audio,
  "-filter_complex", `${stufe(0, SETUP)};${stufe(1, DAUER - SETUP)};[v0][v1]concat=n=2:v=1:a=0[v];[2:a]atrim=0:${DAUER},afade=t=in:d=0.8,afade=t=out:st=${DAUER - 1.5}:d=1.5[a]`,
  "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "26", "-pix_fmt", "yuv420p", "-r", "30",
  "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-movflags", "+faststart", path.join(ordner, "reel.mp4")]);

console.log(`Reel fertig mit „${track.titel}“ (${track.datei})`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `musik=${track.titel}\n`);
