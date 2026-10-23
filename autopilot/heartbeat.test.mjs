import test from "node:test";
import assert from "node:assert/strict";
import { ueberfaellig } from "./heartbeat.mjs";

// Nur ab dem Vortag vergleichen; das 36-Stunden-Fenster reicht je nach Uhrzeit weiter zurück
const ids = (iso, ab = "2026-11-09") => ueberfaellig(new Date(iso)).map((s) => s.id).filter((id) => id >= ab);
const gestern = ["2026-11-09-07", "2026-11-09-16"];

test("vor 12 Uhr ist nur der Vortag fällig", () => {
  // 10.11.2026 09:00 Wien (MEZ = UTC+1)
  assert.deepEqual(ids("2026-11-10T08:00:00Z"), gestern);
});
test("nach 12 Uhr ist der Morgenslot fällig", () => {
  assert.deepEqual(ids("2026-11-10T11:30:00Z"), [...gestern, "2026-11-10-07"]);
});
test("nach 20 Uhr ist auch der Nachmittagsslot fällig", () => {
  assert.deepEqual(ids("2026-11-10T19:15:00Z"), [...gestern, "2026-11-10-07", "2026-11-10-16"]);
});
test("Sommerzeit (MESZ = UTC+2) wird richtig umgerechnet", () => {
  // 24.10.2026 10:30 UTC = 12:30 Wien
  assert.ok(ids("2026-10-24T10:30:00Z", "2026-10-24").includes("2026-10-24-07"));
  assert.ok(!ids("2026-10-24T09:30:00Z", "2026-10-24").includes("2026-10-24-07"));
});
