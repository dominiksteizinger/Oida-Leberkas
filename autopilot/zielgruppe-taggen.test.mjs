import { test } from "node:test";
import assert from "node:assert/strict";
import { zuordnungLesen, taggen } from "./zielgruppe-taggen.mjs";

test("Zuordnung lesen, Kommentare überspringen, Tippfehler melden", () => {
  const m = zuordnungLesen("# Kopf\n12 dating\n13 alltag at\n");
  assert.deepEqual(m.get(12), { zielgruppe: "dating" });
  assert.deepEqual(m.get(13), { zielgruppe: "alltag", region: "at" });
  assert.throws(() => zuordnungLesen("14 datnig"));
});

test("Taggen ändert nur den JSON-Block und nur einmal", () => {
  const body = 'Notiz.\n\n```json\n{"inhalt":{"format":"szene","satz":"Ä 🙈"},"caption":"x"}\n```';
  const neu = taggen(body, { zielgruppe: "akku" });
  assert.match(neu, /^Notiz\.\n\n```json\n\{"zielgruppe":"akku","inhalt":\{"format":"szene","satz":"Ä 🙈"\},"caption":"x"\}\n```$/);
  assert.equal(taggen(neu, { zielgruppe: "dating" }), null);
  assert.equal(taggen("kein json", { zielgruppe: "akku" }), null);
});
