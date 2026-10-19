import { test } from "node:test";
import assert from "node:assert/strict";
import { reihenfolge } from "./reihenfolge.mjs";

const post = (nr, createdAt, extra = "") => ({ nr, createdAt, body: "```json\n{ \"caption\": \"x\"" + extra + " }\n```" });

test("Posts mit bis kommen vor freien Posts, frühestes Ende zuerst", () => {
  const liste = [
    post(1, "2026-10-01T00:00:00Z"),
    post(2, "2026-10-02T00:00:00Z", ', "ab": "2026-11-01", "bis": "2026-11-03"'),
    post(3, "2026-10-20T00:00:00Z", ', "bis": "2026-10-27"'),
    post(4, "2026-10-03T00:00:00Z"),
  ].sort(reihenfolge);
  assert.deepEqual(liste.map((p) => p.nr), [3, 2, 1, 4]);
});

test("Gleiches Ende oder beide frei: ältestes zuerst", () => {
  const liste = [post(1, "2026-10-05T00:00:00Z", ', "bis": "2026-10-27"'), post(2, "2026-10-04T00:00:00Z", ',"bis":"2026-10-27"')].sort(reihenfolge);
  assert.deepEqual(liste.map((p) => p.nr), [2, 1]);
});
