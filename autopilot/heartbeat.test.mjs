import test from "node:test";
import assert from "node:assert/strict";
import { ueberfaellig } from "./heartbeat.mjs";

// Nur ab dem Vortag vergleichen; das 36-Stunden-Fenster reicht je nach Uhrzeit weiter zurück
const ids = (iso, ab = "2026-11-09") => ueberfaellig(new Date(iso)).map((s) => s.id).filter((id) => id >= ab);
const gestern = ["2026-11-09-07", "2026-11-09-11", "2026-11-09-16", "2026-11-09-22"];

test("vor 11 Uhr ist nur der Vortag fällig", () => {
  // 10.11.2026 09:00 Wien (MEZ = UTC+1)
  assert.deepEqual(ids("2026-11-10T08:00:00Z"), gestern);
});
test("ab 11 Uhr ist der Morgenslot fällig", () => {
  assert.deepEqual(ids("2026-11-10T10:30:00Z"), [...gestern, "2026-11-10-07"]);
});
test("ab 16 Uhr ist der Mittagsslot fällig", () => {
  assert.deepEqual(ids("2026-11-10T15:15:00Z"), [...gestern, "2026-11-10-07", "2026-11-10-11"]);
});
test("um 23 Uhr sind alle vier Slots fällig", () => {
  assert.deepEqual(ids("2026-11-10T22:15:00Z"), [...gestern, "2026-11-10-07", "2026-11-10-11", "2026-11-10-16", "2026-11-10-22"]);
});
test("Sommerzeit (MESZ = UTC+2) wird richtig umgerechnet", () => {
  // 24.10.2026 09:30 UTC = 11:30 Wien
  assert.ok(ids("2026-10-24T09:30:00Z", "2026-10-24").includes("2026-10-24-07"));
  assert.ok(!ids("2026-10-24T08:30:00Z", "2026-10-24").includes("2026-10-24-07"));
});
test("die Slots 11 und 22 zählen erst ab dem Umstieg", () => {
  // 23.10.2026 09:30 Wien: am 22.10. gab es 11 noch nicht, 22 schon
  assert.deepEqual(ids("2026-10-23T07:30:00Z", "2026-10-22"), ["2026-10-22-07", "2026-10-22-16", "2026-10-22-22"]);
});
