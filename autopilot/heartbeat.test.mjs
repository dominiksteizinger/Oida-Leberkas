import test from "node:test";
import assert from "node:assert/strict";
import { ueberfaellig } from "./heartbeat.mjs";

const ids = (iso) => ueberfaellig(new Date(iso)).map((s) => s.id);

test("vor 12 Uhr ist nur der Vortag fällig", () => {
  // 20.10.2026 09:00 Wien (MESZ = UTC+2)
  assert.deepEqual(ids("2026-10-20T07:00:00Z"), ["2026-10-19-07", "2026-10-19-16"]);
});
test("nach 12 Uhr ist der Morgenslot fällig", () => {
  assert.deepEqual(ids("2026-10-20T10:30:00Z"), ["2026-10-19-07", "2026-10-19-16", "2026-10-20-07"]);
});
test("nach 20 Uhr ist auch der Nachmittagsslot fällig", () => {
  assert.deepEqual(ids("2026-10-20T18:15:00Z"), ["2026-10-19-07", "2026-10-19-16", "2026-10-20-07", "2026-10-20-16"]);
});
test("Winterzeit (MEZ = UTC+1) wird richtig umgerechnet", () => {
  // 27.10.2026 11:30 UTC = 12:30 Wien
  assert.ok(ids("2026-10-27T11:30:00Z").includes("2026-10-27-07"));
  assert.ok(!ids("2026-10-27T10:30:00Z").includes("2026-10-27-07"));
});
