// Musterbibliothek (Dominik 22.10.2026: „Fähigkeiten, Witze zu erstellen, aus Seiten rausziehen, die nur mit Witzen und Memes bespielt sind“).
// Gag-Typen aus erfolgreichen Witzen und Memes (witz-muster.json, lesbar in witz-muster.md). Jeder neue Post nennt im Feld `muster`,
// nach welcher Bauweise er gebaut ist. pruefen.mjs prüft, dass das Muster bekannt ist, zur `mechanik` passt und sich im Lauf nicht häuft.
//   node witzmuster.mjs md > witz-muster.md   (Datei neu erzeugen, nach jeder Änderung an witz-muster.json)
//   node witzmuster.mjs                        (Kurzliste der Muster)
import fs from "node:fs";

const DATEI = new URL("./witz-muster.json", import.meta.url).pathname;
export const BIBLIOTHEK = JSON.parse(fs.readFileSync(DATEI, "utf8"));
export const MUSTER = Object.fromEntries(BIBLIOTHEK.muster.map((m) => [m.id, m]));

// pflicht: neue Posts (pruefen.mjs) brauchen ein Muster, alte in der Warteschlange nicht.
export function musterLesen(roh, { pflicht = false } = {}) {
  const erlaubt = Object.keys(MUSTER).join(", ");
  if (roh.muster === undefined || roh.muster === null || roh.muster === "") {
    if (pflicht) throw new Error(`muster fehlt: Nach welcher Bauweise ist der Witz gebaut? (eins von: ${erlaubt}, siehe witz-muster.md)`);
    return null;
  }
  const m = MUSTER[roh.muster];
  if (!m) throw new Error(`muster „${roh.muster}“ unbekannt (erlaubt: ${erlaubt})`);
  if (roh.mechanik && !m.mechanik.includes(roh.mechanik)) throw new Error(`muster „${roh.muster}“ passt nicht zur mechanik „${roh.mechanik}“ (passend: ${m.mechanik.join(", ")})`);
  return roh.muster;
}

// Ein Lauf soll verschiedene Bauweisen zeigen: kein Muster in mehr als einem Viertel der Posts (mindestens 2 erlaubt).
export function pruefeMusterMischung(posts) {
  const zaehl = new Map();
  for (const p of posts) if (MUSTER[p.muster]) zaehl.set(p.muster, (zaehl.get(p.muster) || 0) + 1);
  const max = Math.max(2, Math.ceil(posts.length / 4));
  return [...zaehl].filter(([, n]) => n > max).map(([id, n]) => `muster „${id}“ ${n}-mal im Lauf (höchstens ${max}); andere Bauweisen aus witz-muster.md nehmen`);
}

export function markdown(b = BIBLIOTHEK) {
  const z = [
    `# Witz-Muster: Bauweise erfolgreicher Witze und Memes (Stand ${b.stand})`,
    "",
    "Erzeugt aus `witz-muster.json` mit `node witzmuster.mjs md > witz-muster.md`, nicht von Hand ändern.",
    "",
    "Dominik, 22.10.2026: von Seiten lernen, die nur mit Witzen und Memes bespielt sind. Gelernt wird die **Bauweise**, nie Text, Figur oder Bild. Jeder neue Post nennt im Feld `muster` eines der Muster unten (Pflicht, `pruefen.mjs`). Das Muster muss zur `mechanik` passen und ergänzt den Gag-Bauplan in `regeln.md`, es ersetzt ihn nicht. Meme-Regeln gelten unverändert: keine fremden Figuren, Marken oder echten Personen, nichts Sexualisiertes, nie Männer als Gruppe.",
    "",
    "## Was die Zählung zeigt",
    "",
    ...b.kennzahlen.map((k) => `- ${k}`),
    "",
    "**Für Resi heißt das:** Die Wende sitzt im letzten Wort, das Resi sagt. Gesamt höchstens 25 Wörter im Bild, der Schluss 1 bis 6. Kontrast und Umdeutung sind die verlässlichsten Mechaniken, Selbstironie wirkt am besten als „ich durchschaue mich selbst“ (bedingung-verraet, selbstbetrug-rechnung), nie als Jammern.",
    "",
    "## Übersicht",
    "",
    "| muster | Gag-Typ | mechanik | Länge | Wende |",
    "|---|---|---|---|---|",
    ...b.muster.map((m) => `| \`${m.id}\` | ${m.name} | ${m.mechanik.join(", ")} | ${m.woerter} | ${m.wende} |`),
    "",
    "## Die Muster",
    "",
  ];
  for (const m of b.muster) {
    z.push(`### \`${m.id}\`: ${m.name}`, "",
      `- **Bauweise:** ${m.bauweise}`,
      `- **Länge:** ${m.woerter}. **Wende:** ${m.wende}.`,
      `- **Warum es zündet:** ${m.warum}`,
      `- **Für Resi:** ${m.resi}`,
      `- **Falle:** ${m.falle}`,
      `- **mechanik:** ${m.mechanik.join(", ")}`,
      `- **Quellen:** ${m.quellen.map((q, i) => `[${i + 1}](${q})`).join(", ")}`,
      "");
  }
  z.push("## Gegenbeispiele (so nicht)", "", "| Muster | Warum nicht | Quelle |", "|---|---|---|",
    ...b.gegenbeispiele.map((g) => `| ${g.muster} | ${g.warum} | ${g.quelle.startsWith("http") ? `[Link](${g.quelle})` : `\`${g.quelle}\``} |`), "",
    "## Nutzung", "",
    "- **Nachschub** (`nachschub.md`, Schritt 7) und **Schnellweg** (`schnellweg.md`, Schritt 5): vor dem Schreiben diese Datei lesen, für jeden Post zuerst das Muster wählen, dann den Text bauen. Ein Muster höchstens in einem Viertel der Posts eines Laufs (`pruefen.mjs`).",
    "- **Gegenleser** (`gegenleser.md`): Wer durchfällt, wird mit Blick auf die Falle seines Musters umgeschrieben.",
    "- **Quelle zum Nachladen:** `trends.yml` holt sonntags die neuesten Beziehungs-Sammlungen von Twitterperlen (nur Titel und Anriss, Bauweise lernen, nie Text übernehmen). Neue Bauweisen, die dort öfter auftauchen, kommen als neues Muster in `witz-muster.json`.",
    "");
  return z.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === "md") process.stdout.write(markdown());
  else console.log(BIBLIOTHEK.muster.map((m) => `${m.id}: ${m.name} (${m.mechanik.join(", ")})`).join("\n"));
}
