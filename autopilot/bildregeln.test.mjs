// Tests der Bildregeln: node --test autopilot/bildregeln.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bildKonfig, fingerabdruck, kandidaten, pruefeBild, pruefeTags, verbuchen } from "./bildregeln.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const bibliothek = pruefeTags(JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8")));
const konf = bildKonfig({});
const eintrag = (text) => ({ inhalt: { format: "szene", satz: text, klammern: ["eins", "zwei"] }, caption: "Caption.", aufforderung: "Speichern.", hashtags: [] });

test("alle Bilder haben gültige Tags", () => {
  assert.equal(bibliothek.length, 56);
});

test("Anlassbild nur im Zeitraum", () => {
  const n = [];
  assert.equal(pruefeBild({ bibliothek, nutzung: n, bild: "adventkranz-semmel.jpg", datum: "2026-10-19", konf }).ok, false);
  assert.equal(pruefeBild({ bibliothek, nutzung: n, bild: "adventkranz-semmel.jpg", datum: "2026-12-10", konf }).ok, true);
});

test("Silvester über den Jahreswechsel", () => {
  const n = [];
  const s = (d) => pruefeBild({ bibliothek, nutzung: n, bild: "silvester-fenster.jpg", datum: d, konf }).ok;
  assert.equal(s("2026-12-20"), false);
  assert.equal(s("2026-12-31"), true);
  assert.equal(s("2027-01-01"), true);
  assert.equal(s("2027-01-02"), false);
});

test("Anlassbild wird nie wiederverwendet", () => {
  const n = [{ id: "a", datum: "2026-12-10", slot: "07", bild: "adventkranz-semmel.jpg" }];
  const r = pruefeBild({ bibliothek, nutzung: n, bild: "adventkranz-semmel.jpg", datum: "2026-12-20", konf });
  assert.equal(r.ok, false);
  assert.match(r.grund, /Anlassbild/);
});

test("Mindestabstand 21 Tage, Vortag und gleicher Tag gesperrt", () => {
  const n = [{ id: "a", datum: "2026-09-01", slot: "07", bild: "herbstlaub-strasse.jpg" }];
  const p = (d, k = konf) => pruefeBild({ bibliothek, nutzung: n, bild: "herbstlaub-strasse.jpg", datum: d, konf: k });
  assert.equal(p("2026-09-20").ok, false);
  assert.equal(p("2026-09-22").ok, true);
  assert.equal(p("2026-09-22").wiederverwendung, true);
  assert.equal(p("2026-09-01").ok, false);
  assert.equal(p("2026-09-02", bildKonfig({ BILD_ABSTAND_TAGE: "0" })).ok, false, "Vortag bleibt gesperrt");
  assert.equal(p("2026-09-05", bildKonfig({ BILD_ABSTAND_TAGE: "0" })).ok, true);
});

test("BILD_RECYCLING=aus: nur ungenutzte Bilder", () => {
  const n = [{ id: "a", datum: "2026-09-01", slot: "07", bild: "herbstlaub-strasse.jpg" }];
  const k = bildKonfig({ BILD_RECYCLING: "aus" });
  assert.equal(pruefeBild({ bibliothek, nutzung: n, bild: "herbstlaub-strasse.jpg", datum: "2026-10-01", konf: k }).ok, false);
  assert.equal(pruefeBild({ bibliothek, nutzung: n, bild: "friedhofsbank-herbst.jpg", datum: "2026-10-01", konf: k }).ok, true);
});

test("Konfiguration: Standard an und 21 Tage, Umgebung wird übernommen", () => {
  assert.deepEqual(bildKonfig({}), { recycling: true, abstand: 21 });
  assert.deepEqual(bildKonfig({ BILD_RECYCLING: "aus", BILD_ABSTAND_TAGE: "30" }), { recycling: false, abstand: 30 });
  assert.equal(bildKonfig({ BILD_ABSTAND_TAGE: "kaputt" }).abstand, 21);
});

test("Eigener Eintrag (Neuversuch) zählt nicht als frühere Nutzung", () => {
  const n = [{ id: "2026-10-19-07", datum: "2026-10-19", slot: "07", bild: "nebel-friedhof.jpg" }];
  assert.equal(pruefeBild({ bibliothek, nutzung: n, bild: "nebel-friedhof.jpg", datum: "2026-10-19", konf, id: "2026-10-19-07" }).ok, true);
  assert.equal(pruefeBild({ bibliothek, nutzung: n, bild: "nebel-friedhof.jpg", datum: "2026-10-19", konf, id: "2026-10-19-16" }).ok, false);
});

test("Identischer Text bei Wiederverwendung wird abgelehnt", () => {
  const alt = eintrag("Endlich Nebel.");
  const n = [{ id: "a", datum: "2026-09-01", slot: "07", bild: "nebel-friedhof.jpg", fingerabdruck: fingerabdruck(alt) }];
  const gleich = pruefeBild({ bibliothek, nutzung: n, bild: "nebel-friedhof.jpg", datum: "2026-10-01", konf, e: eintrag("Endlich Nebel.") });
  assert.equal(gleich.ok, false);
  assert.match(gleich.grund, /identisch/);
  const neu = pruefeBild({ bibliothek, nutzung: n, bild: "nebel-friedhof.jpg", datum: "2026-10-01", konf, e: { ...eintrag("Ganz anderer Satz."), caption: "Anders." } });
  assert.equal(neu.ok, true);
  const gleicheCaption = pruefeBild({ bibliothek, nutzung: n, bild: "nebel-friedhof.jpg", datum: "2026-10-01", konf, e: { ...eintrag("Ganz anderer Satz."), caption: "Caption." } });
  assert.equal(gleicheCaption.ok, false, "gleiche Caption zählt als identischer Text");
});

test("Reihenfolge: ungenutzte zuerst, Anlass vor Rest, dann älteste Nutzung", () => {
  const n = [
    { id: "a", datum: "2026-08-01", slot: "07", bild: "dach-besen-winkt.jpg" },
    { id: "b", datum: "2026-08-15", slot: "07", bild: "dach-besen-sitzt.jpg" },
  ];
  const liste = kandidaten({ bibliothek, nutzung: n, datum: "2026-10-19", konf });
  const erste = liste.findIndex((k) => k.wiederverwendung);
  assert.ok(erste > 0);
  assert.ok(liste.slice(0, erste).every((k) => !k.wiederverwendung));
  const wieder = liste.filter((k) => k.wiederverwendung).map((k) => k.datei);
  assert.deepEqual(wieder, ["dach-besen-winkt.jpg", "dach-besen-sitzt.jpg"]);
  // Anlass zur Saison steht vor dem Rest unter den ungenutzten
  const ungenutzt = liste.filter((k) => !k.wiederverwendung);
  assert.equal(ungenutzt[0].saisonal, true);
});

test("verbuchen ersetzt denselben Eintrag und speichert den Fingerabdruck", () => {
  let n = verbuchen([], { id: "x", datum: "2026-10-20", slot: "07", bild: "dach-besen-winkt.jpg", e: eintrag("Eins.") });
  n = verbuchen(n, { id: "x", datum: "2026-10-20", slot: "07", bild: "dach-besen-winkt.jpg", e: eintrag("Zwei.") });
  assert.equal(n.length, 1);
  assert.equal(n[0].fingerabdruck.inhalt, fingerabdruck(eintrag("Zwei.")).inhalt);
});
