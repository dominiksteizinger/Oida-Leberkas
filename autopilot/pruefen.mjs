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
import { pruefeSchluss } from "./schluss.mjs";
import { bildMass, pruefeAusschnitt, pruefeGeschichte } from "./ausschnitt.mjs";
import { simuliere, ablaufBericht, anlassLuecken } from "./ablauf.mjs";
import { fehlerartVon, haeufigste, gruendeLesen, FEHLERARTEN } from "./fehlerarten.mjs";
import { verlaufLesen } from "./humorquote.mjs";
import { zgVerlaufLesen } from "./zielgruppe.mjs";
import { bisVon } from "./reihenfolge.mjs";
import { musterLesen, pruefeMusterMischung } from "./witzmuster.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const bibliothek = pruefeTags(JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8")));
const nachDatei = new Map(bibliothek.map((b) => [b.datei, b]));
const DATUM = /^\d{4}-\d{2}-\d{2}$/;
// So weit reicht die Warteschlange höchstens (Tage); bis dahin muss ein Saisonbild ohne „bis“ noch passen
const HORIZONT = 35;

// Alle Bilder eines Posts (geschichte: jedes Szenenbild)
const bilderAus = (post) => [...new Set([...(post?.inhalt?.format === "geschichte" && Array.isArray(post.inhalt.szenen) ? post.inhalt.szenen.map((x) => x?.bild) : []), post?.bild].filter(Boolean))];
const bildAus = (body) => {
  const m = String(body).match(/```json\s*([\s\S]*?)```/);
  try { return m ? bilderAus(JSON.parse(m[1])) : []; } catch { return []; }
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
  // Bauweise aus der Musterbibliothek (witz-muster.md), Pflicht für neue Posts
  versuch(() => musterLesen(post, { pflicht: true }));
  fehler.push(...pruefeBauplan(post));
  // Schluss-Check: bekannte Fehler der letzten Zeile (flach, ohne neues Wort, zu lang, Gegenüber hat die Pointe; schluss.mjs)
  if (e) fehler.push(...pruefeSchluss(post));
  // Zielgruppe ist für neue Posts Pflicht; Ü40-Signale nur mit Begründung (zielgruppe.mjs)
  versuch(() => zielgruppeLesen(post, { pflicht: true }));
  versuch(() => pruefeUe40(post));
  for (const k of ["ab", "bis"]) if (post[k] !== undefined && !DATUM.test(post[k])) fehler.push(`${k} muss JJJJ-MM-TT sein`);
  if (post.ab && post.bis && post.ab > post.bis) fehler.push("ab liegt nach bis");
  if (post.bis && DATUM.test(post.bis) && heute && post.bis < heute) fehler.push(`bis (${post.bis}) liegt in der Vergangenheit`);
  if (post.slot !== undefined && !["07", "11", "16", "22"].includes(String(post.slot))) fehler.push("slot muss \"07\", \"11\", \"16\" oder \"22\" sein");
  const format = post.inhalt?.format;
  const bilder = bilderAus(post);
  if (e && !OHNE_BILD.has(format) && !bilder.length) fehler.push(`Format ${format} braucht ein Bild`);
  fehler.push(...pruefeGeschichte(post, bibliothek, (d) => bildMass(path.join(HIER, "bilder", d))));
  for (const datei of bilder) {
    const b = nachDatei.get(datei);
    if (!b) { if (format !== "geschichte") fehler.push(`Bild ${datei} gibt es nicht in bibliothek.json`); }
    else {
      // Kopf im Bildausschnitt (ausschnitt.mjs)
      let mass = null;
      try { mass = bildMass(path.join(HIER, "bilder", b.datei)); } catch {}
      fehler.push(...pruefeAusschnitt(post, b, mass));
      // Anlassbilder (Allerheiligen, Advent …) nur mit ab/bis in ihrem Zeitraum. Saisonbilder (Herbst, Winter) ohne bis
      // müssen noch bis zum Ende der Warteschlange passen, sonst lehnt holen.mjs den Post später ab.
      const tags = (b.tags || []).join(", ");
      const anlass = (b.tags || []).some((t) => TAGS[t]?.wiederverwendbar === false);
      if (anlass && (!post.ab || !post.bis)) fehler.push(`Bild ${datei} ist ein Anlassbild (${tags}), der Post braucht ab und bis`);
      for (const k of ["ab", "bis"]) if (post[k] && !passtZuDatum(b, post[k])) fehler.push(`Bild ${datei} passt nicht zum ${k}-Datum ${post[k]} (Tags: ${tags})`);
      if (!post.bis && heute) {
        const ende = new Date(Date.parse(heute + "T12:00:00Z") + HORIZONT * 864e5).toISOString().slice(0, 10);
        for (const d of [post.ab || heute, ende]) if (!passtZuDatum(b, d)) { fehler.push(`Bild ${datei} (${tags}) passt am ${d} nicht mehr; Post bekommt ein bis oder ein anderes Bild`); break; }
      }
    }
    if (belegt.has(datei)) fehler.push(`Bild ${datei} steckt schon in ${belegt.get(datei)}`);
  }
  const body = `${notiz ? `${notiz}\n\n` : ""}\`\`\`json\n${JSON.stringify(post)}\n\`\`\``;
  return { fehler, issue: { title: titel, body } };
}

export function pruefeAlle(posts, offen = [], heute) {
  const belegt = new Map();
  offen.forEach((o, i) => {
    for (const bild of bildAus(typeof o === "string" ? o : o.body)) belegt.set(bild, typeof o === "object" && o.number ? `#${o.number}` : `wartendem Post ${i + 1}`);
  });
  return posts.map((p, i) => {
    const r = pruefePost(p, { belegt, heute });
    for (const bild of bilderAus(p)) if (!belegt.has(bild)) belegt.set(bild, `neuem Post ${i + 1} („${p.titel}“)`);
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
  // Erinnerung: woran Posts zuletzt gescheitert sind (auswertung/gruende.json, Gegenleser, Flops, Dominik)
  const top = haeufigste(gruendeLesen(path.join(HIER, "..", "auswertung", "gruende.json")), { heute });
  if (top.length) console.log(`Zuletzt am häufigsten nicht witzig: ${top.map((g) => `${g.name} (${g.gewicht})`).join(", ")}. Prüffragen: ${top.map((g) => FEHLERARTEN[g.art].frage).join(" ")}\n`);
  const ergebnis = pruefeAlle(posts, offen, heute);
  let ok = true;
  ergebnis.forEach((r, i) => {
    if (r.fehler.length) { ok = false; console.log(`✗ ${i + 1}. ${posts[i].titel || "(ohne Titel)"}\n  - ${r.fehler.map((f) => { const a = fehlerartVon(f); return a ? `[${FEHLERARTEN[a].name}] ${f}` : f; }).join("\n  - ")}`); }
    else console.log(`✓ ${i + 1}. ${posts[i].titel}`);
  });
  const mischung = [...pruefeMischung(posts), ...pruefeMusterMischung(posts)];
  if (mischung.length) { ok = false; console.log(`✗ Mischung des Laufs\n  - ${mischung.join("\n  - ")}`); }
  if (!ok) { console.log("\nNicht angelegt: erst alle Fehler beheben."); process.exit(1); }
  if (opt("--issues")) fs.writeFileSync(opt("--issues"), JSON.stringify(ergebnis.map((r) => r.issue), null, 2) + "\n");
  console.log(`\n${posts.length} Posts in Ordnung.${opt("--issues") ? ` Issue-Texte in ${opt("--issues")}.` : ""}`);
  // Mit --warteschlange: Warteschlange plus neue Posts so durchspielen, wie holen.mjs sie postet (ablauf.mjs). Nur Hinweis, kein Abbruch.
  if (offen.length) {
    const json = (b) => { const m = String(b).match(/```json\s*([\s\S]*?)```/); try { return m ? JSON.parse(m[1]) : {}; } catch { return {}; } };
    const alle = [...offen.filter((o) => typeof o === "object").sort((a, b) => (bisVon(a.body) || "9").localeCompare(bisVon(b.body) || "9") || a.number - b.number).map((o) => ({ nr: o.number, post: json(o.body) })),
      ...posts.map((p, i) => ({ nr: `neu ${i + 1}`, post: p }))];
    const tagebuch = path.join(HIER, "..", "tagebuch"), id = `${heute}-99`;
    console.log(`\n${ablaufBericht(simuliere(alle, verlaufLesen(tagebuch, id), zgVerlaufLesen(tagebuch, id))).text}`);
    const nutzung = JSON.parse(fs.readFileSync(path.join(HIER, "nutzung.json"), "utf8"));
    const luecken = anlassLuecken({ bibliothek, nutzung, bilder: alle.flatMap((x) => bilderAus(x.post)), heute });
    console.log(luecken.length ? `⚠ Anlässe ohne Post:\n${luecken.map((l) => `  - ${l}`).join("\n")}` : "Anlässe der nächsten 10 Tage: alle mit Post in der Warteschlange.");
  }
}
