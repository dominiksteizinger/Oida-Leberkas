// Ablauf-Simulation (Gesamt-Check 22.10.2026): Spielt die Warteschlange Slot für Slot so durch, wie holen.mjs sie abarbeitet
// (Anlass-Posts zuerst, Humor- und Zielgruppen-Quote, Bedarf), und zählt, wie oft eine Quote verletzt würde.
// Grund: Am 22.10. waren 22 von 31 wartenden Posts dating; ab etwa dem 17. Slot hätte jeder Post eine Quote-Warnung ausgelöst.
// Bilder und Slot-Wünsche spielen hier keine Rolle, es geht nur um die Mischung.
import { pruefeQuote } from "./humorquote.mjs";
import { pruefeZielgruppe, sortiereKandidaten, ZIELGRUPPEN } from "./zielgruppe.mjs";

// posts: [{ nr, post }] in Warteschlangen-Reihenfolge. verlauf/zgVerlauf wie in holen.mjs (zuletzt gepostet, ältester zuerst).
export function simuliere(posts, verlauf = [], zgVerlauf = []) {
  let rest = [...posts];
  const v = [...verlauf], zv = [...zgVerlauf], schritte = [];
  while (rest.length) {
    const kandidaten = [];
    let zurueck = null;
    rest.forEach((x, rang) => {
      const p = x.post, datiert = !!(p.ab || p.bis);
      const a = pruefeQuote(v, p.mechanik || null), b = pruefeZielgruppe(zv, { zielgruppe: p.zielgruppe || null, region: p.region || "dach" });
      if ((a.ok && b.ok) || datiert) kandidaten.push({ x, zielgruppe: p.zielgruppe, rang, datiert });
      else zurueck = zurueck || { x, grund: a.ok ? b.grund : a.grund };
    });
    const g = sortiereKandidaten(kandidaten, zv)[0];
    const x = g ? g.x : zurueck.x;
    schritte.push({ nr: x.nr, mechanik: x.post.mechanik || null, zielgruppe: x.post.zielgruppe || null, warnung: g ? null : zurueck.grund });
    rest = rest.filter((y) => y !== x);
    v.push(x.post.mechanik || null);
    zv.push({ zielgruppe: x.post.zielgruppe || null, region: x.post.region || "dach" });
  }
  return schritte;
}

// Kurzer Bericht: wie viele Warnungen, ab welchem Slot, und welche Zielgruppen fehlen, damit es glatt läuft.
export function ablaufBericht(schritte) {
  const warn = schritte.filter((s) => s.warnung);
  if (!warn.length) return { ok: true, text: `Ablauf-Simulation: ${schritte.length} Slots ohne Quote-Warnung.` };
  const erste = schritte.findIndex((s) => s.warnung) + 1;
  const zaehl = (k) => schritte.filter((s) => s.zielgruppe === k).length;
  const ueber = Object.entries(ZIELGRUPPEN).filter(([k, z]) => zaehl(k) / schritte.length > z.max / 14).map(([k]) => `${k} ${zaehl(k)}/${schritte.length}`);
  const unter = Object.entries(ZIELGRUPPEN).filter(([k, z]) => z.max >= 2 && zaehl(k) / schritte.length < (z.max / 14) / 2).map(([k]) => k);
  return {
    ok: false,
    text: [`⚠ Ablauf-Simulation: ${warn.length} von ${schritte.length} Slots verletzen eine Quote, erstmals im ${erste}. Slot (bei 4 Posts am Tag nach etwa ${Math.ceil(erste / 4)} Tagen).`,
      ueber.length ? `  - Zu viel in der Warteschlange: ${ueber.join(", ")}` : null,
      unter.length ? `  - Fehlt fürs Mischen: ${unter.join(", ")}. Neue Posts zuerst dort schreiben.` : null,
      ...warn.slice(0, 3).map((s) => `  - #${s.nr}: ${s.warnung}`)].filter(Boolean).join("\n"),
  };
}
