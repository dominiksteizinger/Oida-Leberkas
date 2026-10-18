// Lädt das Reel eines Tages als YouTube Short hoch (hochkant, unter 3 Minuten, #Shorts im Titel).
// Braucht YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET und einen Refresh-Token mit dem Bereich youtube.upload.
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const [datum, reel] = process.argv.slice(2);
if (!datum || !reel) throw new Error("Aufruf: node youtube.mjs <datum> <reel.mp4>");
if (!fs.existsSync(reel)) throw new Error(`${reel} fehlt`);
const e = JSON.parse(fs.readFileSync(path.join(HIER, "..", "tagebuch", datum, "eintrag.json"), "utf8"));

const token = await (await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  body: new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
})).json();
if (!token.access_token) throw new Error(`YouTube-Zugang: ${token.error_description || token.error}`);
if (!String(token.scope).includes("youtube.upload")) throw new Error("Der Refresh-Token hat keinen Upload-Bereich (youtube.upload)");

// Titel höchstens 100 Zeichen, ohne spitze Klammern
const kurz = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const titel = kurz(`${e.folie2} #Shorts`.replace(/[<>]/g, ""), 100);
const beschreibung = [e.folie1, e.folie2, e.caption, e.aufforderung, e.hashtags.join(" ")].filter(Boolean).join("\n\n").replace(/[<>]/g, "");

const meta = {
  snippet: { title: titel, description: beschreibung, tags: e.hashtags.map((h) => h.replace(/^#/, "")), categoryId: "23", defaultLanguage: "de" },
  // containsSyntheticMedia: KI-Kennzeichnung nach den YouTube-Regeln für realistisch wirkende KI-Inhalte; bewusst immer gesetzt
  status: { privacyStatus: process.env.YOUTUBE_SICHTBARKEIT || "public", selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
};

const video = fs.readFileSync(reel);
const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token.access_token}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": "video/mp4",
    "X-Upload-Content-Length": String(video.length),
  },
  body: JSON.stringify(meta),
});
if (!start.ok) throw new Error(`YouTube-Upload starten: ${start.status} ${await start.text()}`);
const res = await fetch(start.headers.get("location"), { method: "PUT", headers: { "Content-Type": "video/mp4" }, body: video });
const j = await res.json();
if (!res.ok) throw new Error(`YouTube-Upload: ${j.error?.message || res.status}`);
console.log(`YouTube: hochgeladen (https://youtube.com/shorts/${j.id})`);
