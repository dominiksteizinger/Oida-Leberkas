// Lädt das Reel eines Posts zu TikTok hoch.
// TIKTOK_MODUS=entwurf (Standard): landet als Entwurf in der TikTok-Inbox, Veröffentlichen per Fingertipp in der App (Bereich video.upload).
// TIKTOK_MODUS=direkt: wird direkt mit Text veröffentlicht (Bereich video.publish). Solange die App nicht geprüft ist, erlaubt TikTok nur „Nur ich“.
// Braucht TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET und TIKTOK_REFRESH_TOKEN. Gibt die Resttage des Refresh-Tokens aus (GITHUB_OUTPUT: tage=<n>).
import fs from "node:fs";
import path from "node:path";
import { captionText } from "./eintrag.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const [id, reel] = process.argv.slice(2);
if (!id || !reel) throw new Error("Aufruf: node tiktok.mjs <id> <reel.mp4>");
if (!fs.existsSync(reel)) throw new Error(`${reel} fehlt`);
const e = JSON.parse(fs.readFileSync(path.join(HIER, "..", "tagebuch", id, "eintrag.json"), "utf8"));

const API = "https://open.tiktokapis.com/v2";
const MODUS = process.env.TIKTOK_MODUS || "entwurf";
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const ausgabe = (zeilen) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, zeilen);

// Beim Einfügen ins Secret rutscht leicht ein Zeilenumbruch mit
const geheim = (name) => (process.env[name] || "").replace(/\s+/g, "");
// Content-Type wie bei curl, ohne den Zusatz „;charset=UTF-8“, den fetch sonst anhängt (TikTok meldete damit „malformed“)
const token = await (await fetch(`${API}/oauth/token/`, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_key: geheim("TIKTOK_CLIENT_KEY"),
    client_secret: geheim("TIKTOK_CLIENT_SECRET"),
    refresh_token: geheim("TIKTOK_REFRESH_TOKEN"),
    grant_type: "refresh_token",
  }).toString(),
})).json();
if (!token.access_token) throw new Error(`TikTok-Zugang: ${token.error_description || token.error}`);
const tage = Math.floor(token.refresh_expires_in / 86400);
console.log(`TikTok: Refresh-Token gilt noch ${tage} Tage.`);
ausgabe(`tage=${tage}\n`);
if (token.refresh_token && token.refresh_token !== geheim("TIKTOK_REFRESH_TOKEN")) {
  console.log("::warning::TikTok hat einen neuen Refresh-Token ausgegeben. Falls der nächste Lauf am Zugang scheitert, Token über oidaleberkas.at/tiktok/ neu holen.");
}

async function api(pfad, body) {
  const res = await fetch(`${API}/${pfad}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body ?? {}),
  });
  const j = await res.json();
  if (!res.ok || (j.error && j.error.code !== "ok")) throw new Error(`TikTok ${pfad}: ${j.error?.code} ${j.error?.message || res.status}`);
  return j.data;
}

// Bis 64 MB in einem Stück, sonst 10-MB-Stücke; das letzte Stück nimmt den Rest mit
const video = fs.readFileSync(reel);
const groesse = video.length;
const stueck = groesse <= 64 * 1024 * 1024 ? groesse : 10 * 1024 * 1024;
const anzahl = Math.floor(groesse / stueck);
const quelle = { source: "FILE_UPLOAD", video_size: groesse, chunk_size: stueck, total_chunk_count: anzahl };

let init;
if (MODUS === "direkt") {
  const creator = await api("post/publish/creator_info/query/");
  const wunsch = process.env.TIKTOK_SICHTBARKEIT || "PUBLIC_TO_EVERYONE";
  const optionen = creator.privacy_level_options || [];
  const sichtbarkeit = optionen.includes(wunsch) ? wunsch : optionen[0];
  if (sichtbarkeit !== wunsch) console.log(`::warning::TikTok erlaubt ${wunsch} nicht (App noch nicht geprüft?), poste als ${sichtbarkeit}.`);
  init = await api("post/publish/video/init/", {
    post_info: {
      title: captionText(e).slice(0, 2200),
      privacy_level: sichtbarkeit,
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000,
      // KI-Kennzeichnung nach den TikTok-Regeln; bewusst immer gesetzt
      is_aigc: true,
    },
    source_info: quelle,
  });
} else {
  init = await api("post/publish/inbox/video/init/", { source_info: quelle });
}

for (let i = 0; i < anzahl; i++) {
  const von = i * stueck;
  const bis = i === anzahl - 1 ? groesse : von + stueck;
  const res = await fetch(init.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(bis - von), "Content-Range": `bytes ${von}-${bis - 1}/${groesse}` },
    body: video.subarray(von, bis),
  });
  if (!res.ok) throw new Error(`TikTok-Upload Stück ${i + 1}/${anzahl}: ${res.status} ${await res.text()}`);
}

console.log(`TikTok: hochgeladen (${init.publish_id}), warte auf Verarbeitung`);
const ziel = MODUS === "direkt" ? "PUBLISH_COMPLETE" : "SEND_TO_USER_INBOX";
let zuletzt = "";
// Die Zustellung in die Inbox dauerte im Test gut 3 Minuten, daher bis zu 10 Minuten warten
for (let i = 0; i < 120; i++) {
  const s = await api("post/publish/status/fetch/", { publish_id: init.publish_id });
  if (s.status !== zuletzt) console.log(`TikTok-Status: ${s.status}`);
  zuletzt = s.status;
  if (s.status === ziel) {
    console.log(MODUS === "direkt" ? `TikTok: veröffentlicht (${init.publish_id})` : `TikTok: als Entwurf in der Inbox (${init.publish_id}), in der App veröffentlichen`);
    process.exit(0);
  }
  if (s.status === "FAILED") throw new Error(`TikTok konnte das Video nicht verarbeiten: ${s.fail_reason}`);
  await warte(5000);
}
// Hochgeladen ist das Video; meldet TikTok das Ende nicht rechtzeitig, nur warnen statt den Lauf rot zu machen
console.log(`::warning::TikTok hat nach 10 Minuten noch „${zuletzt}“ gemeldet. Das Video ist hochgeladen, bitte in der App nachsehen.`);
