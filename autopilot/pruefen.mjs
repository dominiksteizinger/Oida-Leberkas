// Prüft neue Posts vor dem Anlegen, mit denselben Regeln wie holen.mjs, und baut die Issue-Texte für die Warteschlange.
//   node pruefen.mjs <neu.json> [--warteschlange <offen.json>] [--issues <aus.json>]
// neu.json: Liste von Posts, jeder mit `titel` (Issue-Titel) und `notiz` (ein Satz über dem JSON-Block, optional), sonst wie im README.
// offen.json (optional): Liste der offenen Warteschlangen-Issues als { number, body } oder nur die Bodies. Damit erkennt die Prüfung
// Bilder, die schon in einem wartenden Post stecken (sonst scheitert später einer der beiden an der Abstandsregel).
// --issues schreibt [{ title, body }] zum Anlegen. Exit 1, wenn ein Post durchfällt; dann wird nichts geschrieben.
import fs from "node:fs";
import path from "node:path";
import { Eintrag } from "./eintrag.mjs";
import { OHNE_BILD } from "./formate.mjs";
import { TAGS, passtZuDatum, pruefeTags } from "./bildregeln.mjs";
import { pruefeWortfilter } from "./wortfilter.mjs";
import { mechanikLesen, pruefeMischung, pruefeBauplan } from "./humorquote.mjs";
import { zielgruppeLesen, pruefeUe40 } from "./zielgruppe.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const bibliothek = pruefeTags(JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8")));
const nachDatei = new Map(bibliothek.map((b) => [b.datei, b]));
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// So weit reicht die Warteschlange höchstens (Tage); bis dahin muss ein Saisonbild ohne „bis“ noch passen
const HORIZONT = 35;

const bildAus = (body) => {
  const m = String(body).match(/```json\s*([\s\S]*?)```/);
  try { return m ? JSON.parse(m[1]).bild || null : null; } catch { return null; }
};

export function pruefePost(roh, { belegt = new Map(), heute } = {}) {
  const fehler = [];
  const versuch = (fn) => { try { fn(); } catch (err) { fehler.push(err.message); } };
  if (!roh.titel || typeof roh.titel !== "string") fehler.push("titel fehlt");
  const { titel, notiz, ...post } = roh;
  let e;
  versuch(() => { e = Eintrag.parse(post); });
  versuch(() => pruefeWortfilter(post));
  // Mechanik der Wende ist für neue Posts Pflicht (Witz-Parameter, humorquote.mjs)
  versuch(() => mechanikLesen(post, { pflicht: true }));
  fehler.push(...pruefeBauplan(post));
  // Zielgruppe ist für neue Posts Pflicht; Ü40-Signale nur mit Begründung (zielgruppe.mjs)
  versuch(() => zielgruppeLesen(post, { pflicht: true }));
  versuch(() => pruefeUe40(post));
  for (const k of ["ab", "bis"]) if (post[k] !== undefined && !DATUM.test(post[k])) fehler.push(`${k} muss JJJJ-MM-TT sein`);
  if (post.ab && post.bis && post.ab > post.bis) fehler.push("ab liegt nach bis");
  if (post.bis && DATUM.test(post.bis) && heute && post.bis < heute) fehler.push(`bis (${post.bis}) liegt in der Vergangenheit`);
  if (post.slot !== undefined && !["07", "11", "16", "22"].includes(String(post.slot))) fehler.push("slot muss \"07\", \"11\", \"16\" oder \"22\" sein");
  const format = post.inhalt?.format;
  if (e && !OHNE_BILD.has(format) && !post.bild) fehler.push(`Format ${format} braucht ein Bild`);
  if (post.bild) {
    const b = nachDatei.get(post.bild);
    if (!b) fehler.push(`Bild ${post.bild} gibt es nicht in bibliothek.json`);
    else {
      // Anlassbilder (Allerheiligen, Advent …) nur mit ab/bis in ihrem Zeitraum. Saisonbilder (Herbst, Winter) ohne bis
      // müssen noch bis zum Ende der Warteschlange passen, sonst lehnt holen.mjs den Post später ab.
      const tags = (b.tags || []).join(", ");
      const anlass = (b.tags || []).some((t) => TAGS[t]?.wiederverwendbar === false);
      if (anlass && (!post.ab || !post.bis)) fehler.push(`Bild ${post.bild} ist ein Anlassbild (${tags}), der Post braucht ab und bis`);
      for (const k of ["ab", "bis"]) if (post[k] && !passtZuDatum(b, post[k])) fehler.push(`Bild ${post.bild} passt nicht zum ${k}-Datum ${post[k]} (Tags: ${tags})`);
      if (!post.bis && heute) {
        const ende = new Date(Date.parse(heute + "T12:00:00Z") + HORIZONT * 864e5).toISOString().slice(0, 10);
        for (const d of [post.ab || heute, ende]) if (!passtZuDatum(b, d)) { fehler.push(`Bild ${post.bild} (${tags}) passt am ${d} nicht mehr; Post bekommt ein bis oder ein anderes Bild`); break; }
      }
    }
    if (belegt.has(post.bild)) fehler.push(`Bild ${post.bild} steckt schon in ${belegt.get(post.bild)}`);
  }
  const body = `${notiz ? `${notiz}\n\n` : ""}\`\`\`json\n${JSON.stringify(post)}\n\`\`\``;
  return { fehler, issue: { title: titel, body } };
}

export function pruefeAlle(posts, offen = [], heute) {
  const belegt = new Map();
  offen.forEach((o, i) => {
    const bild = bildAus(typeof o === "string" ? o : o.body);
    if (bild) belegt.set(bild, typeof o === "object" && o.number ? `#${o.number}` : `wartendem Post ${i + 1}`);
  });
  return posts.map((p, i) => {
    const r = pruefePost(p, { belegt, heute });
    if (p.bild && !belegt.has(p.bild)) belegt.set(p.bild, `neuem Post ${i + 1} („${p.titel}“)`);
    return r;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const datei = args[0];
  if (!datei || datei.startsWith("--")) throw new Error("Aufruf: node pruefen.mjs <neu.json> [--warteschlange <offen.json>] [--issues <aus.json>]");
  const posts = JSON.parse(fs.readFileSync(datei, "utf8"));
  const offen = opt("--warteschlange") ? JSON.parse(fs.readFileSync(opt("--warteschlange"), "utf8")) : [];
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
  const ergebnis = pruefeAlle(posts, offen, heute);
  let ok = true;
  ergebnis.forEach((r, i) => {
    if (r.fehler.length) { ok = false; console.log(`✗ ${i + 1}. ${posts[i].titel || "(ohne Titel)"}\n  - ${r.fehler.join("\n  - ")}`); }
    else console.log(`✓ ${i + 1}. ${posts[i].titel}`);
  });
  const mischung = pruefeMischung(posts);
  if (mischung.length) { ok = false; console.log(`✗ Mischung des Laufs\n  - ${mischung.join("\n  - ")}`); }
  if (!ok) { console.log("\nNicht angelegt: erst alle Fehler beheben."); process.exit(1); }
  if (opt("--issues")) fs.writeFileSync(opt("--issues"), JSON.stringify(ergebnis.map((r) => r.issue), null, 2) + "\n");
  console.log(`\n${posts.length} Posts in Ordnung.${opt("--issues") ? ` Issue-Texte in ${opt("--issues")}.` : ""}`);
}
