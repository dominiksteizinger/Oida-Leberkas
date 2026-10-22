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
