// Postet das Karussell eines Tages auf Instagram und (falls freigeschaltet) auf der Facebook-Seite.
// Die Bilder müssen schon öffentlich auf oidaleberkas.at liegen.
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const datum = process.argv[2];
if (!datum) throw new Error("Aufruf: node posten.mjs <datum>");
const e = JSON.parse(fs.readFileSync(path.join(HIER, "..", "tagebuch", datum, "eintrag.json"), "utf8"));

const GRAPH = "https://graph.facebook.com";
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG = process.env.IG_USER_ID || "17841454284048783";
const SEITE = process.env.FB_PAGE_ID || "1415408888319545";
const BASIS = process.env.SEITEN_URL || "https://oidaleberkas.at";
const bilder = [1, 2].map((n) => `${BASIS}/tagebuch/${datum}/folie-${n}.jpg`);
const text = `${e.caption}\n\n${e.hashtags.join(" ")}`;
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(pfad, felder) {
  const res = await fetch(`${GRAPH}/${pfad}`, { method: "POST", body: new URLSearchParams({ ...felder, access_token: TOKEN }) });
  const j = await res.json();
  if (!res.ok || j.error) throw new Error(`${pfad}: ${j.error?.message || res.status}`);
  return j;
}

// Warten, bis GitHub Pages die neuen Bilder ausliefert
for (let i = 0; ; i++) {
  const ok = (await Promise.all(bilder.map((u) => fetch(u, { method: "HEAD" }).then((r) => r.ok).catch(() => false)))).every(Boolean);
  if (ok) break;
  if (i >= 40) throw new Error("Bilder sind nach 10 Minuten noch nicht online");
  await warte(15000);
}

// Instagram: zwei Karussell-Elemente, dann Container, dann veröffentlichen
const kinder = [];
for (const url of bilder) kinder.push((await graph(`${IG}/media`, { image_url: url, is_carousel_item: "true" })).id);
const container = (await graph(`${IG}/media`, { media_type: "CAROUSEL", children: kinder.join(","), caption: text })).id;
for (let i = 0; i < 20; i++) {
  const s = await (await fetch(`${GRAPH}/${container}?fields=status_code&access_token=${TOKEN}`)).json();
  if (s.status_code === "FINISHED") break;
  if (s.status_code === "ERROR") throw new Error("Instagram konnte das Karussell nicht verarbeiten");
  await warte(5000);
}
const ig = await graph(`${IG}/media_publish`, { creation_id: container });
console.log(`Instagram: veröffentlicht (${ig.id})`);

// Facebook-Seite: Fotos unveröffentlicht hochladen, dann als ein Beitrag posten
if (process.env.FACEBOOK_POSTEN === "an") {
  const fotos = [];
  for (const url of bilder) fotos.push((await graph(`${SEITE}/photos`, { url, published: "false" })).id);
  const felder = { message: text };
  fotos.forEach((id, i) => (felder[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id })));
  const fb = await graph(`${SEITE}/feed`, felder);
  console.log(`Facebook: veröffentlicht (${fb.id})`);
}
