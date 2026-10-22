import test from "node:test";
import assert from "node:assert/strict";
import { simuliere, ablaufBericht } from "./ablauf.mjs";

const post = (nr, zielgruppe, mechanik, extra = {}) => ({ nr, post: { zielgruppe, mechanik, ...extra } });

test("Ablauf: gemischte Warteschlange läuft ohne Warnung", () => {
  const q = [post(1, "dating", "absage"), post(2, "dating", "ertappt"), post(3, "jobstart", "kontrast"), post(4, "dating", "umdeutung"), post(5, "akku", "gestaendnis")];
  const s = simuliere(q);
  assert.equal(s.filter((x) => x.warnung).length, 0);
  assert.equal(ablaufBericht(s).ok, true);
});

test("Ablauf: nur dating läuft in die Zielgruppen-Quote, Bericht nennt fehlende Zielgruppen", () => {
  const q = Array.from({ length: 6 }, (_, i) => post(i + 1, "dating", ["absage", "ertappt", "umdeutung"][i % 3]));
  const s = simuliere(q);
  assert.equal(s[2].warnung?.includes("dating"), true);
  const b = ablaufBericht(s);
  assert.equal(b.ok, false);
  assert.match(b.text, /erstmals im 3\. Slot/);
  assert.match(b.text, /jobstart/);
});

test("Ablauf: Anlass-Posts laufen trotz Quote ohne Warnung", () => {
  const s = simuliere([post(1, "dating", "absage"), post(2, "jobstart", "ertappt"), post(3, "dating", "absage", { ab: "2026-10-24", bis: "2026-10-25" })]);
  assert.equal(s[0].nr, 3);
  assert.equal(s.filter((x) => x.warnung).length, 0);
});

test("Anlass-Lücken: Anlassbild frei und kein Post geplant → Hinweis, mit Post oder benutzt → keiner", async () => {
  const { anlassLuecken } = await import("./ablauf.mjs");
  const bibliothek = [{ datei: "kuerbis.jpg", tags: ["halloween"] }, { datei: "uhr.jpg", tags: ["zeitumstellung"] }, { datei: "advent.jpg", tags: ["advent"] }];
  const l = anlassLuecken({ bibliothek, nutzung: [{ bild: "uhr.jpg" }], bilder: [], heute: "2026-10-22" });
  assert.equal(l.length, 1);
  assert.match(l[0], /halloween.*kuerbis\.jpg/);
  assert.deepEqual(anlassLuecken({ bibliothek, bilder: ["kuerbis.jpg", "uhr.jpg"], heute: "2026-10-22" }), []);
});
