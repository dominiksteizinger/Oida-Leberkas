// Heartbeat: meldet, wenn ein Slot (07, 11, 16 oder 22) nicht gepostet wurde, etwa weil cron-job.org ausgefallen ist.
// Läuft stündlich über den GitHub-Cron (.github/workflows/heartbeat.yml), unabhängig vom Autopilot-Lauf, ohne Zusatzkosten.
// Ein Slot gilt als gepostet, wenn tagebuch/<id>/gepostet.txt existiert oder ein Warteschlangen-Issue den Kommentar „Gepostet als <id>.“ trägt.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Ab dieser Uhrzeit (Wien) gilt ein Slot als überfällig. Der Autopilot versucht jeden Slot stündlich bis zum Beginn des nächsten (07: 7-10, 11: 11-15, 16: 16-21, 22: 22-23 Uhr).
export const FAELLIG = { "07": 11, 11: 16, 16: 22, 22: 23 };
// Die Slots 11 und 22 gibt es erst seit dem Umstieg auf vier Posts am Tag; frühere zählen nicht als Ausfall
export const VIER_SLOTS_AB = "2026-10-22-16";
const NEUE_SLOTS = new Set(["11", "22"]);
const FENSTER_STUNDEN = 36; // weiter zurück wird nicht gesucht, sonst meldet der Heartbeat Alt-Slots vor dem Start

const wien = (d) => {
  const t = Object.fromEntries(new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((p) => [p.type, p.value]));
  return { datum: `${t.year}-${t.month}-${t.day}`, stunde: Number(t.hour) };
};

// Überfällige Slots der letzten 36 Stunden, ältester zuerst: [{ id, datum, slot }]
export function ueberfaellig(jetzt = new Date()) {
  const aus = [];
  for (let h = FENSTER_STUNDEN; h >= 0; h--) {
    const { datum, stunde } = wien(new Date(jetzt.getTime() - h * 3600e3));
    for (const [slot, ab] of Object.entries(FAELLIG)) {
      const id = `${datum}-${slot}`;
      if (NEUE_SLOTS.has(slot) && id < VIER_SLOTS_AB) continue;
      if (stunde === ab && !aus.some((x) => x.id === id)) aus.push({ id, datum, slot });
    }
  }
  return aus;
}

// ---- Läuft nur als Skript mit gh ----
const gh = (...a) => execFileSync("gh", a, { encoding: "utf8" });
const ghJson = (...a) => JSON.parse(gh(...a) || "null");

export function ersterLivePost(wurzel) {
  const dir = path.join(wurzel, "tagebuch");
  if (!fs.existsSync(dir)) return null;
  return fs.readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}-\d{2}$/.test(d) && fs.existsSync(path.join(dir, d, "gepostet.txt"))).sort()[0] || null;
}

function gepostet(id, wurzel, abgehakt) {
  return fs.existsSync(path.join(wurzel, "tagebuch", id, "gepostet.txt")) || abgehakt.has(id);
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  const owner = process.env.GITHUB_REPOSITORY_OWNER;
  if (process.env.LIVE !== "true") return console.log("POSTEN ist nicht „an“: kein Live-Betrieb, nichts zu prüfen.");
  const wurzel = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
  const jetzt = process.env.JETZT ? new Date(process.env.JETZT) : new Date();

  const kommentare = ghJson("issue", "list", "--repo", repo, "--label", "warteschlange", "--state", "closed", "--limit", "40", "--json", "comments");
  const abgehakt = new Set(kommentare.flatMap((i) => i.comments).filter((c) => c.author.login === "github-actions")
    .map((c) => c.body.match(/^Gepostet als (\d{4}-\d{2}-\d{2}-\d{2})\.$/)?.[1]).filter(Boolean));

  gh("label", "create", "ausfall", "--repo", repo, "--color", "D73A4A", "--description", "Slot wurde nicht gepostet", "--force");
  const offen = ghJson("issue", "list", "--repo", repo, "--label", "ausfall", "--state", "open", "--json", "number,title");

  // Slots vor dem ersten Live-Post zählen nicht (Probebetrieb hat kein gepostet.txt)
  const ersterLive = ersterLivePost(wurzel);
  // Inzwischen nachgeholt (oder vor dem Live-Start): Meldung schließen
  for (const i of offen) {
    const id = i.title.match(/\d{4}-\d{2}-\d{2}-\d{2}/)?.[0];
    if (id && (gepostet(id, wurzel, abgehakt) || (ersterLive && id < ersterLive))) gh("issue", "close", String(i.number), "--repo", repo, "--comment", "Inzwischen gepostet oder vor dem Live-Start, kein Ausfall.");
  }

  const fehlt = ueberfaellig(jetzt).filter((s) => ersterLive && s.id > ersterLive && !gepostet(s.id, wurzel, abgehakt));
  if (!fehlt.length) return console.log("Alle fälligen Slots sind gepostet.");

  const laeufe = ghJson("run", "list", "--repo", repo, "--workflow", "autopilot.yml", "--limit", "8", "--json", "createdAt,event,conclusion,status,url") || [];
  const leer = ghJson("issue", "list", "--repo", repo, "--label", "leer", "--state", "open", "--json", "number") || [];
  for (const s of fehlt) {
    if (offen.some((i) => i.title.includes(s.id))) { console.log(`${s.id}: schon gemeldet.`); continue; }
    const letzter = laeufe[0];
    const lauf = letzter
      ? `Letzter Autopilot-Lauf: ${letzter.createdAt} (${letzter.event}, ${letzter.status === "completed" ? letzter.conclusion : letzter.status}), ${letzter.url}`
      : "Es gibt keinen Autopilot-Lauf in der Liste.";
    const ursache = leer.length
      ? `Wahrscheinlich war die Warteschlange leer (siehe Issue #${leer[0].number}).`
      : (!letzter || (jetzt - new Date(letzter.createdAt)) / 3600e3 > 6)
        ? "Seit über 6 Stunden kam kein Lauf: Bitte cron-job.org prüfen (Konto, Jobs 07:17 und 16:17, Token). Notfalls: Actions → Autopilot → Run workflow."
        : "Läufe kamen, aber der Slot wurde nicht gepostet: Das Lauf-Protokoll und offene Issues mit Label lauf-fehler ansehen.";
    gh("issue", "create", "--repo", repo, "--label", "ausfall", "--assignee", owner,
      "--title", `Slot ${s.id} nicht gepostet`,
      "--body", `Der Post für ${s.datum}, ${s.slot} Uhr, wurde bis ${FAELLIG[s.slot]} Uhr nicht gepostet.\n\n${ursache}\n\n${lauf}\n\nDas Issue schließt sich, sobald der Slot nachgeholt ist.`);
    console.log(`${s.id}: Issue angelegt.`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
