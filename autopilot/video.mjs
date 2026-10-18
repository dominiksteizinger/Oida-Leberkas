// Macht aus dem Post ein Reel ohne Ton: erst das Setup (post-a.jpg), nach einer Pause der ganze Post (post.jpg).
// Ergebnis: tagebuch/<id>/reel.mp4 (1080x1920) für Instagram-Reels und YouTube Shorts.
// Die Tonspur ist stumm (Dominik 18.10.2026: Reels ganz ohne Ton); sie bleibt drin, weil manche Plattformen eine erwarten.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const id = process.argv[2];
if (!id) throw new Error("Aufruf: node video.mjs <id>");
const ordner = path.join(HIER, "..", "tagebuch", id);
const SETUP = 2.8;
const DAUER = 8;
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });

// Beide Stufen hochkant auf dunklem Grund mit leichtem Zoom; harter Schnitt von Setup auf Pointe
const stufe = (n, d) => `[${n}:v]scale=1080:-2,zoompan=z='min(zoom+0.0003,1.04)':d=${Math.round(d * 30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1350:fps=30,pad=1080:1920:0:285:color=0x0D090C,setsar=1[v${n}]`;
ff(["-i", path.join(ordner, "post-a.jpg"), "-i", path.join(ordner, "post.jpg"), "-f", "lavfi", "-t", String(DAUER), "-i", "anullsrc=r=44100:cl=stereo",
  "-filter_complex", `${stufe(0, SETUP)};${stufe(1, DAUER - SETUP)};[v0][v1]concat=n=2:v=1:a=0[v]`,
  "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-preset", "medium", "-crf", "26", "-pix_fmt", "yuv420p", "-r", "30",
  "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-movflags", "+faststart", path.join(ordner, "reel.mp4")]);

console.log("Reel fertig (ohne Ton)");
