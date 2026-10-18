// Sammelt Dominiks Urteile für den nächsten Lauf. Zwei Quellen:
// 1. Issues mit Label gut/schlecht (seine Kommentare sind die Begründung).
// 2. Die Sammelliste: Daumen hoch/runter auf einem Eintrag-Kommentar, oder ein eigener Kommentar,
//    der mit „gut“ oder „schlecht“ beginnt (optional mit Datum davor, sonst gilt der Eintrag direkt darüber).
// Ausgabe: JSON-Liste {urteil, text, kommentare} nach $1, Zählung im Log und in der Job-Zusammenfassung.
import fs from "node:fs";

const API = process.env.GITHUB_API_URL || "https://api.github.com";
const REPO = process.env.GITHUB_REPOSITORY;
const BESITZER = process.env.GITHUB_REPOSITORY_OWNER;
const ZIEL = process.argv[2];
const JE_URTEIL = 15;

async function hole(pfad) {
  const ergebnis = [];
  for (let seite = 1; ; seite++) {
    const r = await fetch(`${API}/repos/${REPO}/${pfad}${pfad.includes("?") ? "&" : "?"}per_page=100&page=${seite}`, {
      headers: { accept: "application/vnd.github+json", ...(process.env.GH_TOKEN && { authorization: `Bearer ${process.env.GH_TOKEN}` }) },
    });
    if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
    const teil = await r.json();
    ergebnis.push(...teil);
    if (teil.length < 100) return ergebnis;
  }
}

const vonDominik = (x) => x.user?.login === BESITZER;
// Zitierte Zeilen (Antworten per „Zitieren“) und HTML-Kommentare entfernen
const ohneZitat = (s) => s.split("\n").filter((z) => !z.startsWith(">")).join("\n").trim();
const URTEIL = /^(?:(\d{4}-\d{2}-\d{2})\s*[:,.–-]?\s*)?(gut|schlecht)\b[\s:,.!–-]*([\s\S]*)$/i;
const KOPF = /^## Eintrag (\d{4}-\d{2}-\d{2})/;

const liste = [];

// 1. Issues mit Label
for (const urteil of ["gut", "schlecht"]) {
  const issues = (await hole(`issues?labels=${urteil}&state=all&sort=created&direction=desc`)).filter((i) => !i.pull_request);
  for (const i of issues.slice(0, JE_URTEIL)) {
    const kommentare = (await hole(`issues/${i.number}/comments`)).filter(vonDominik).map((k) => k.body.trim());
    liste.push({ urteil, text: (i.body || "").split("\n<!--")[0].trim(), kommentare: kommentare.join(" / "), zeit: i.created_at });
  }
}

// 2. Sammelliste
let zaehlung = { gut: 0, schlecht: 0, offen: 0 };
for (const issue of await hole("issues?labels=sammelliste&state=all")) {
  const kommentare = await hole(`issues/${issue.number}/comments`);
  const eintraege = [];
  for (const k of kommentare) {
    const kopf = k.user?.type === "Bot" && k.body.match(KOPF);
    if (kopf) {
      const text = k.body.split("\n").slice(1).filter((z) => z.trim() && !z.startsWith("![")).join("\n");
      const e = { datum: kopf[1], text, urteil: null, begruendung: [], zeit: k.created_at };
      if (k.reactions?.["+1"] || k.reactions?.["-1"]) {
        const reaktionen = (await hole(`issues/comments/${k.id}/reactions`)).filter(vonDominik);
        const letzte = reaktionen.filter((r) => r.content === "+1" || r.content === "-1").at(-1);
        if (letzte) e.urteil = letzte.content === "+1" ? "gut" : "schlecht";
      }
      eintraege.push(e);
      continue;
    }
    if (!vonDominik(k)) continue;
    // Ein zitierter Kopf („> ## Eintrag …“) zeigt, auf welchen Eintrag sich die Antwort bezieht
    const zitiert = k.body.split("\n").find((z) => z.startsWith(">") && KOPF.test(z.replace(/^>\s*/, "")));
    const m = ohneZitat(k.body).match(URTEIL);
    if (!m) continue;
    const datum = m[1] || zitiert?.replace(/^>\s*/, "").match(KOPF)[1];
    const ziel = datum ? eintraege.filter((e) => e.datum === datum).at(-1) : eintraege.at(-1);
    if (!ziel) continue;
    ziel.urteil = m[2].toLowerCase();
    if (m[3].trim()) ziel.begruendung.push(m[3].trim());
  }
  for (const e of eintraege) {
    zaehlung[e.urteil || "offen"]++;
    if (e.urteil) liste.push({ urteil: e.urteil, text: e.text, kommentare: e.begruendung.join(" / "), zeit: e.zeit });
  }
}

// Neueste zuerst, höchstens 15 je Urteil
liste.sort((a, b) => b.zeit.localeCompare(a.zeit));
const ausgabe = ["gut", "schlecht"].flatMap((u) => liste.filter((b) => b.urteil === u).slice(0, JE_URTEIL)).map(({ zeit, ...b }) => b);
fs.writeFileSync(ZIEL, JSON.stringify(ausgabe, null, 2));

const zeile = `Sammelliste: ${zaehlung.gut} gut, ${zaehlung.schlecht} schlecht, ${zaehlung.offen} offen. An den Lauf übergeben: ${ausgabe.length} bewertete Einträge.`;
console.log(zeile);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${zeile}\n\n`);
