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
// Seit Dominiks Urteil („erinnert mich an Witze vor 10 Jahren“, 22.10.2026): ab 4 Posts mindestens die Hälfte aus aktuellen
// Mustern (2024 bis 2026), veraltete klassische Zweizeiler höchstens ein Viertel (mindestens 1 erlaubt).
export function pruefeMusterMischung(posts) {
  const fehler = [];
  const zaehl = new Map();
  for (const p of posts) if (MUSTER[p.muster]) zaehl.set(p.muster, (zaehl.get(p.muster) || 0) + 1);
  const max = Math.max(2, Math.ceil(posts.length / 4));
  for (const [id, n] of zaehl) if (n > max) fehler.push(`muster „${id}“ ${n}-mal im Lauf (höchstens ${max}); andere Bauweisen aus witz-muster.md nehmen`);
  const mit = posts.filter((p) => MUSTER[p.muster]);
  if (mit.length >= 4) {
    const aktuell = mit.filter((p) => MUSTER[p.muster].generation === "aktuell").length;
    if (aktuell < mit.length / 2) fehler.push(`nur ${aktuell} von ${mit.length} Posts mit aktuellem Muster (mindestens die Hälfte, witz-muster.md „aktuell“)`);
    const alt = mit.filter((p) => MUSTER[p.muster].veraltet).length;
    const maxAlt = Math.max(1, Math.floor(mit.length / 4));
    if (alt > maxAlt) fehler.push(`${alt} Posts mit veraltetem Zweizeiler-Muster (höchstens ${maxAlt})`);
  }
  return fehler;
}

const stand = (m) => (m.generation === "aktuell" ? "aktuell 2024–26" : m.veraltet ? "veraltet (Zweizeiler)" : "klassisch, bewährt");
const rang = (m) => (m.generation === "aktuell" ? 0 : m.veraltet ? 2 : 1);
const sortiert = (liste) => [...liste].sort((a, b) => rang(a) - rang(b));

export function markdown(b = BIBLIOTHEK) {
  const z = [
    `# Witz-Muster: Bauweise erfolgreicher Witze und Memes (Stand ${b.stand})`,
    "",
    "Erzeugt aus `witz-muster.json` mit `node witzmuster.mjs md > witz-muster.md`, nicht von Hand ändern.",
    "",
    "Dominik, 22.10.2026: von Seiten lernen, die nur mit Witzen und Memes bespielt sind. Gelernt wird die **Bauweise**, nie Text, Figur oder Bild. Jeder neue Post nennt im Feld `muster` eines der Muster unten (Pflicht, `pruefen.mjs`). **Aktuelle Muster (2024–26) zuerst**: mindestens die Hälfte jedes Laufs, veraltete Zweizeiler höchstens ein Viertel. Das Muster muss zur `mechanik` passen und ergänzt den Gag-Bauplan in `regeln.md`, es ersetzt ihn nicht. Meme-Regeln gelten unverändert: keine fremden Figuren, Marken oder echten Personen, nichts Sexualisiertes, nie Männer als Gruppe. **Gelockert seit 23.10.2026** (Dominik: Filter und Wirkung standen sich im Weg): Muster mit Wiedererkennen (" + Object.values(MUSTER).filter((m) => m.wiedererkennen).map((m) => "`" + m.id + "`").join(", ") + ") brauchen keine Kippe in der letzten Zeile, der Witz ist das „das bin ich“. Die Mischungsquoten eines Laufs sind nur noch ein Hinweis.",
    "",
    "## Was die Zählung zeigt",
    "",
    ...b.kennzahlen.map((k) => `- ${k}`),
    "",
    "**Für Resi heißt das:** Aktuell zuerst: Blickwinkel, Ton-Bruch, Absurdität und Bild tragen den Witz, nicht ein Punchline-Satz. Bei klassischen Mustern gilt weiter: Die Wende sitzt im letzten Wort, das Resi sagt. Gesamt höchstens 25 Wörter im Bild, der Schluss 1 bis 6. Kontrast und Umdeutung sind die verlässlichsten Mechaniken, Selbstironie wirkt am besten als „ich durchschaue mich selbst“ (bedingung-verraet, selbstbetrug-rechnung), nie als Jammern.",
    "",
    "## Übersicht",
    "",
    "| muster | Gag-Typ | Stand | mechanik | Länge | Wende |",
    "|---|---|---|---|---|---|",
    ...sortiert(b.muster).map((m) => `| \`${m.id}\` | ${m.name} | ${stand(m)} | ${m.mechanik.join(", ")} | ${m.woerter} | ${m.wende} |`),
    "",
    "## Die Muster",
    "",
  ];
  for (const m of sortiert(b.muster)) {
    z.push(`### \`${m.id}\`: ${m.name} (${stand(m)})`, "",
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
    "- **Quellen zum Nachladen:** Aktuelle Formate kommen aus den Fanbase-Quellen im Trends-Issue (Instagram-Hashtags, Dating-Shorts) und `trend-formate.md`; neue Formate, die dort öfter auftauchen, kommen als Muster mit `generation: aktuell` in `witz-muster.json`. Twitterperlen (sonntags im Trends-Lauf) ist Text-Humor der Twitter-Ära und zählt niedriger: Bauweisen von dort nur als `klassisch`.",
    "");
  return z.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === "md") process.stdout.write(markdown());
  else console.log(BIBLIOTHEK.muster.map((m) => `${m.id}: ${m.name} (${m.mechanik.join(", ")})`).join("\n"));
}
