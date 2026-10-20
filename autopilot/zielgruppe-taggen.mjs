// Trägt `zielgruppe` (und `region`) aus zielgruppe-zuordnung.txt in die JSON-Blöcke offener Warteschlangen-Issues ein.
// Issues, die schon eine Zielgruppe haben, bleiben, wie sie sind. Aufruf: node zielgruppe-taggen.mjs [--probe]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { zielgruppeLesen } from "./zielgruppe.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const repo = process.env.GITHUB_REPOSITORY;
const probe = process.argv.includes("--probe");
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });

export function zuordnungLesen(text) {
  const m = new Map();
  for (const zeile of text.split("\n")) {
    const t = zeile.trim();
    if (!t || t.startsWith("#")) continue;
    const [nr, zielgruppe, region] = t.split(/\s+/);
    zielgruppeLesen({ zielgruppe, region }); // wirft bei Tippfehlern
    m.set(Number(nr), { zielgruppe, ...(region ? { region } : {}) });
  }
  return m;
}

// Neuer Body mit den Feldern vorne im JSON, oder null, wenn nichts zu tun ist
export function taggen(body, tags) {
  const m = body.match(/```json\s*([\s\S]*?)```/);
  if (!m) return null;
  const post = JSON.parse(m[1]);
  if (post.zielgruppe) return null;
  return body.replace(m[1], () => JSON.stringify({ ...tags, ...post }) + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const zuordnung = zuordnungLesen(fs.readFileSync(path.join(HIER, "zielgruppe-zuordnung.txt"), "utf8"));
  const offen = JSON.parse(gh("issue", "list", "--repo", repo, "--label", "warteschlange", "--state", "open", "--limit", "300", "--json", "number,body"));
  let n = 0;
  for (const issue of offen) {
    const tags = zuordnung.get(issue.number);
    if (!tags) continue;
    const neu = taggen(issue.body, tags);
    if (!neu) continue;
    n++;
    console.log(`#${issue.number}: ${JSON.stringify(tags)}${probe ? " (Probe)" : ""}`);
    if (!probe) gh("issue", "edit", String(issue.number), "--repo", repo, "--body", neu);
  }
  console.log(`${n} Issues ${probe ? "würden getaggt" : "getaggt"}.`);
}
