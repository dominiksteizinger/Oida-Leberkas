// Zielgruppen-Mechanismus (Deepdive Zielgruppen DACH, 20.10.2026): Jeder Post bekommt im Post-JSON `zielgruppe` (Lebenslage)
// und optional `region` (dach, at, de). Die Wochenquote sorgt dafür, dass die Jungen (18–28) breit getroffen werden,
// die Ü40-Warnliste fängt Themen ab, die nach Büro von 45-Jährigen klingen.
import fs from "node:fs";
import path from "node:path";

// Höchstzahl pro 14 Posts (seit 22.10.2026 dreieinhalb Tage bei vier Posts am Tag). Summe > 14, damit immer etwas passt.
// Ob die Warteschlange damit glatt durchläuft, zeigt ablauf.mjs (pruefen.mjs mit --warteschlange).
export const ZIELGRUPPEN = {
  // Beziehung hat seit 22.10.2026 das meiste Gewicht (Dominik: Fanbase sind junge Frauen, Abblitzen und Dating-Situationen ziehen am meisten)
  dating: { name: "Dating, Beziehung und Ex", max: 8 },
  jobstart: { name: "Berufseinstieg", max: 3 },
  akku: { name: "Sozialer Akku", max: 2 },
  wohnen: { name: "WG und erste Wohnung", max: 2 },
  studium: { name: "Studium", max: 2 },
  familie: { name: "Familie aus Sicht der Jungen", max: 2 },
  ausbildung: { name: "Ausbildung und Lehre", max: 1 },
  szene: { name: "Goth- und Alt-Szene", max: 1 },
  // Für alle gleich (Montag, Wetter, Handy, Zeitumstellung): erlaubt, aber begrenzt, sonst rutscht alles hierher
  alltag: { name: "Alltag allgemein", max: 2 },
};
export const REGIONEN = { dach: "überall verständlich", at: "österreichische Anspielung", de: "deutsche Anspielung" };
export const QUOTE_ZG = { hintereinander: 2, fenster: 14, regionMax: 2 };

// Wörter, die nach Büro und Alltag der Ü40 klingen (Dominik 20.10.2026: „viele Witze zielen auf 40+“).
// Treffer sind kein Verbot: Der Post braucht dann `ue40_ok` mit einem Satz, warum er trotzdem für Junge funktioniert.
export const UE40 = [
  [/mailverteiler|verteilerliste|allen antworten|reply.?all/i, "Mailverteiler"],
  [/wichteln/i, "Wichteln"],
  [/wir sammeln für|sammeln für .{0,20}geburtstag|geburtstagskarte unterschreiben/i, "Büro-Sammlung"],
  [/kantine/i, "Kantine"],
  [/kaffeekasse/i, "Kaffeekasse"],
  [/betriebsausflug/i, "Betriebsausflug"],
  [/\bfax(gerät|nummer)?\b/i, "Fax"],
  [/festnetz/i, "Festnetz"],
  [/weihnachtsfeier/i, "Weihnachtsfeier"],
  [/adventkranz|adventskranz/i, "Adventkranz"],
  [/umlaufmappe|aktenordner|stempelkarte/i, "Büro-Utensil"],
  [/schwiegermutter|schwiegereltern/i, "Schwiegerfamilie"],
  [/elternabend|elternsprechtag/i, "Elternabend"],
  [/bausparer|eigenheim|reihenhaus/i, "Eigenheim"],
  [/\brente\b|pension(ierung|ist)/i, "Rente"],
];

const OHNE = new Set(["bild", "slot", "ab", "bis", "mechanik", "zielgruppe", "region", "ue40_ok", "annahme", "musik", "quelle", "id", "datum", "trend"]);
function texte(wert, aus = []) {
  if (typeof wert === "string") aus.push(wert);
  else if (Array.isArray(wert)) wert.forEach((w) => texte(w, aus));
  else if (wert && typeof wert === "object") for (const [k, w] of Object.entries(wert)) if (!OHNE.has(k)) texte(w, aus);
  return aus;
}

// Gibt die gefundenen Ü40-Signale zurück (Namen, ohne Doppelte). Leer = unauffällig.
export function ue40Treffer(post) {
  const text = texte(post).join("\n");
  return [...new Set(UE40.filter(([re]) => re.test(text)).map(([, name]) => name))];
}

// Liest und prüft die Felder. pflicht: neue Posts (pruefen.mjs) müssen eine Zielgruppe haben, alte in der Warteschlange nicht.
export function zielgruppeLesen(roh, { pflicht = false } = {}) {
  const zg = roh.zielgruppe;
  if (zg === undefined || zg === null || zg === "") {
    if (pflicht) throw new Error(`zielgruppe fehlt (eine von: ${Object.keys(ZIELGRUPPEN).join(", ")})`);
  } else if (!ZIELGRUPPEN[zg]) throw new Error(`zielgruppe „${zg}“ unbekannt (erlaubt: ${Object.keys(ZIELGRUPPEN).join(", ")})`);
  const region = roh.region ?? "dach";
  if (!REGIONEN[region]) throw new Error(`region „${region}“ unbekannt (erlaubt: ${Object.keys(REGIONEN).join(", ")})`);
  if (roh.ue40_ok !== undefined && (typeof roh.ue40_ok !== "string" || roh.ue40_ok.trim().length < 10)) throw new Error("ue40_ok braucht einen ganzen Satz als Begründung");
  return { zielgruppe: zg || null, region };
}

// Ü40-Prüfung für neue Posts: Treffer ohne Begründung sind ein Fehler.
export function pruefeUe40(roh) {
  const t = ue40Treffer(roh);
  if (t.length && !roh.ue40_ok) throw new Error(`klingt nach Ü40 (${t.join(", ")}). Thema aus Sicht einer 22-Jährigen umschreiben oder "ue40_ok" mit Begründung setzen`);
  return t;
}

// verlauf: [{ zielgruppe, region }] der zuletzt gepostenden Posts, ältester zuerst. kandidat: { zielgruppe, region }.
export function pruefeZielgruppe(verlauf, kandidat, q = QUOTE_ZG) {
  const rest = verlauf.slice(-(q.fenster - 1));
  const { zielgruppe, region = "dach" } = kandidat;
  if (zielgruppe) {
    let reihe = 0;
    for (let i = verlauf.length - 1; i >= 0 && verlauf[i].zielgruppe === zielgruppe; i--) reihe++;
    if (reihe >= q.hintereinander) return { ok: false, grund: `Zielgruppe „${zielgruppe}“ käme zum ${reihe + 1}. Mal hintereinander (erlaubt: ${q.hintereinander})` };
    const n = rest.filter((v) => v.zielgruppe === zielgruppe).length;
    const max = ZIELGRUPPEN[zielgruppe].max;
    if (n >= max) return { ok: false, grund: `Zielgruppe „${zielgruppe}“ käme zum ${n + 1}. Mal in den letzten ${q.fenster} Posts (erlaubt: ${max})` };
  }
  if (region !== "dach") {
    const n = rest.filter((v) => v.region === region).length;
    if (n >= q.regionMax) return { ok: false, grund: `Region „${region}“ käme zum ${n + 1}. Mal in den letzten ${q.fenster} Posts (erlaubt: ${q.regionMax})` };
  }
  return { ok: true };
}

// Wie dringend eine Zielgruppe dran ist: freie Plätze in den letzten 14 Posts (Höchstzahl minus schon gepostet).
// Posts ohne Zielgruppe bekommen 0 und kommen nach allen Zielgruppen, die noch Platz haben.
export function bedarf(verlauf, zielgruppe, q = QUOTE_ZG) {
  if (!zielgruppe || !ZIELGRUPPEN[zielgruppe]) return 0;
  return ZIELGRUPPEN[zielgruppe].max - verlauf.slice(-(q.fenster - 1)).filter((v) => v.zielgruppe === zielgruppe).length;
}

// Reihenfolge der Kandidaten, die alle Quoten erfüllen: Anlass-Posts (ab/bis) zuerst, dann die Zielgruppe mit dem größten Bedarf,
// bei Gleichstand die Reihenfolge der Warteschlange (rang). kandidaten: [{ zielgruppe, datiert, rang }]
export function sortiereKandidaten(kandidaten, verlauf) {
  return [...kandidaten].sort((x, y) => (y.datiert ? 1 : 0) - (x.datiert ? 1 : 0) || bedarf(verlauf, y.zielgruppe) - bedarf(verlauf, x.zielgruppe) || x.rang - y.rang);
}

// Zielgruppe und Region der letzten Posts vor `id` aus tagebuch/<id>/eintrag.json, ältester zuerst
export function zgVerlaufLesen(tagebuch, id, n = QUOTE_ZG.fenster - 1) {
  if (!fs.existsSync(tagebuch)) return [];
  return fs.readdirSync(tagebuch)
    .filter((d) => /^\d{4}-\d{2}-\d{2}-\d{2}$/.test(d) && d < id && fs.existsSync(path.join(tagebuch, d, "eintrag.json")))
    .sort()
    .slice(-n)
    .map((d) => {
      const e = JSON.parse(fs.readFileSync(path.join(tagebuch, d, "eintrag.json"), "utf8"));
      return { zielgruppe: e.zielgruppe || null, region: e.region || "dach" };
    });
}

// Bericht über eine Liste von Posts (Warteschlange oder neue Posts): Verteilung gegen die Quote und Ü40-Treffer.
// posts: [{ nr, titel, post }]. Gibt Markdown zurück.
export function bericht(posts) {
  const zaehl = new Map();
  const regionen = new Map();
  const ue40 = [];
  for (const p of posts) {
    const zg = p.post.zielgruppe || "ohne";
    zaehl.set(zg, (zaehl.get(zg) || 0) + 1);
    const r = p.post.region || "dach";
    regionen.set(r, (regionen.get(r) || 0) + 1);
    const t = ue40Treffer(p.post);
    if (t.length) ue40.push(`- ${p.nr ? `#${p.nr} ` : ""}${p.titel || ""}: ${t.join(", ")}${p.post.ue40_ok ? ` (begründet: ${p.post.ue40_ok})` : ""}`);
  }
  const n = posts.length || 1;
  const z = [`## Zielgruppen (${posts.length} Posts)`, "", "| Zielgruppe | Posts | Anteil | Soll pro 14 | Soll-Anteil |", "|---|---|---|---|---|"];
  for (const [k, v] of Object.entries(ZIELGRUPPEN)) {
    const ist = zaehl.get(k) || 0;
    z.push(`| ${v.name} (${k}) | ${ist} | ${Math.round((ist / n) * 100)} % | ${v.max} | ${Math.round((v.max / 14) * 100)} % |`);
  }
  if (zaehl.get("ohne")) z.push(`| ohne Zielgruppe | ${zaehl.get("ohne")} | ${Math.round((zaehl.get("ohne") / n) * 100)} % | 0 | 0 % |`);
  z.push("", "## Regionen", "", ...Object.keys(REGIONEN).map((r) => `- ${r}: ${regionen.get(r) || 0}`), "");
  z.push("## Ü40-Signale", "", ...(ue40.length ? ue40 : ["- keine"]), "");
  return z.join("\n");
}

// Aufruf: node zielgruppe.mjs <offen.json>  (Liste aus { number, title, body } wie gh issue list --json number,title,body)
if (import.meta.url === `file://${process.argv[1]}`) {
  const datei = process.argv[2];
  if (!datei) throw new Error("Aufruf: node zielgruppe.mjs <offen.json>");
  const posts = JSON.parse(fs.readFileSync(datei, "utf8")).map((i) => {
    const m = String(i.body).match(/```json\s*([\s\S]*?)```/);
    let post = {};
    try { post = m ? JSON.parse(m[1]) : {}; } catch {}
    return { nr: i.number, titel: i.title, post };
  });
  console.log(bericht(posts));
}
