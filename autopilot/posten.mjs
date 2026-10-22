// Postet einen Post auf Instagram (als Reel, wenn es eins gibt, sonst als Bild) und, falls freigeschaltet, auf der Facebook-Seite.
// Bild und Reel müssen schon öffentlich auf oidaleberkas.at liegen.
import fs from "node:fs";
import path from "node:path";
import { captionText } from "./eintrag.mjs";
import { pruefeWortfilter } from "./wortfilter.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const id = process.argv[2];
if (!id) throw new Error("Aufruf: node posten.mjs <id>");
const ordner = path.join(HIER, "..", "tagebuch", id);
const e = JSON.parse(fs.readFileSync(path.join(ordner, "eintrag.json"), "utf8"));

// Letzte Prüfung vor dem Posten: Leberkäse/Semmel nie in Text, Caption oder Hashtags
pruefeWortfilter(e);

const GRAPH = "https://graph.facebook.com";
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG = process.env.IG_USER_ID || "17841454284048783";
const SEITE = process.env.FB_PAGE_ID || "1415408888319545";
const BASIS = process.env.SEITEN_URL || "https://oidaleberkas.at";
const mitReel = fs.existsSync(path.join(ordner, "reel.mp4"));
const bild = `${BASIS}/tagebuch/${id}/post.jpg`;
const reel = `${BASIS}/tagebuch/${id}/reel.mp4`;
const text = captionText(e);
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(pfad, felder) {
  const res = await fetch(`${GRAPH}/${pfad}`, { method: "POST", body: new URLSearchParams({ ...felder, access_token: TOKEN }) });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(`${pfad}: ${j.error?.message || res.status}`);
  return j;
}

// Warten, bis GitHub Pages die neuen Dateien ausliefert
const medien = mitReel ? [bild, reel] : [bild];
for (let i = 0; ; i++) {
  const ok = (await Promise.all(medien.map((u) => fetch(u, { method: "HEAD" }).then((r) => r.ok).catch(() => false)))).every(Boolean);
  if (ok) break;
  if (i >= 40) throw new Error("Dateien sind nach 10 Minuten noch nicht online");
  await warte(15000);
}

async function fertig(container) {
  for (let i = 0; i < 60; i++) {
    const s = await (await fetch(`${GRAPH}/${container}?fields=status_code&access_token=${TOKEN}`)).json();
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR") throw new Error("Instagram konnte das Medium nicht verarbeiten");
    await warte(5000);
  }
  throw new Error("Instagram braucht zu lange für die Verarbeitung");
}

const felder = mitReel
  ? { media_type: "REELS", video_url: reel, cover_url: bild, share_to_feed: "true", caption: text }
  : { image_url: bild, caption: text };
const container = (await graph(`${IG}/media`, felder)).id;
await fertig(container);
const ig = await graph(`${IG}/media_publish`, { creation_id: container });
console.log(`Instagram: veröffentlicht als ${mitReel ? "Reel" : "Bild"} (${ig.id})`);
// IDs je Plattform für die Auswertung (messung.mjs); der Workflow committet die Datei mit gepostet.txt
const plattformen = { instagram: ig.id };
const merken = () => fs.writeFileSync(path.join(ordner, "plattformen.json"), JSON.stringify(plattformen) + "\n");
merken();

// Facebook-Seite: das Bild mit Text. Ein Fehler hier bricht nicht ab, sonst gälte der Slot als
// nicht gepostet und der nächste Lauf stellte denselben Post noch einmal auf Instagram.
if (process.env.FACEBOOK_POSTEN === "an") {
  try {
    // Seitenbeiträge brauchen einen Seiten-Token; den liefert der Nutzer-Token (Recht pages_manage_posts) bei jedem Lauf frisch
    const seite = await (await fetch(`${GRAPH}/${SEITE}?fields=access_token&access_token=${TOKEN}`)).json();
    if (!seite.access_token) throw new Error(`kein Seiten-Token: ${seite.error?.message || "Recht pages_manage_posts fehlt?"}`);
    const res = await fetch(`${GRAPH}/${SEITE}/photos`, { method: "POST", body: new URLSearchParams({ url: bild, message: text, access_token: seite.access_token }) });
    const fb = await res.json();
    if (!res.ok || fb.error) throw new Error(fb.error?.message || res.status);
    console.log(`Facebook: veröffentlicht (${fb.post_id || fb.id})`);
    plattformen.facebook = fb.post_id || fb.id;
    merken();
  } catch (err) {
    console.log(`::warning::Facebook nicht gepostet: ${err.message}`);
  }
}
