import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MUSTER, musterLesen, pruefeMusterMischung, markdown } from "./witzmuster.mjs";
import { MECHANIKEN } from "./humorquote.mjs";

test("jedes Muster ist vollständig, mit bekannter Mechanik und Quelle", () => {
  for (const m of Object.values(MUSTER)) {
    for (const k of ["name", "bauweise", "woerter", "wende", "warum", "resi", "falle"]) assert.ok(m[k], `${m.id}: ${k} fehlt`);
    assert.ok(m.mechanik.length && m.mechanik.every((x) => MECHANIKEN[x]), `${m.id}: mechanik`);
    assert.ok(m.quellen.length && m.quellen.every((q) => q.startsWith("https://")), `${m.id}: quellen`);
  }
});

test("muster Pflicht, bekannt und passend zur Mechanik", () => {
  assert.throws(() => musterLesen({}, { pflicht: true }), /muster fehlt/);
  assert.equal(musterLesen({}), null);
  assert.throws(() => musterLesen({ muster: "gibtsnicht" }), /unbekannt/);
  assert.throws(() => musterLesen({ muster: "bedingung-verraet", mechanik: "absage" }), /passt nicht/);
  assert.equal(musterLesen({ muster: "amtston", mechanik: "absage" }, { pflicht: true }), "amtston");
});

test("kein Muster in mehr als einem Viertel des Laufs", () => {
  const p = (muster) => ({ muster });
  assert.deepEqual(pruefeMusterMischung([p("amtston"), p("amtston"), p("ungefragt")]), []);
  assert.match(pruefeMusterMischung([p("amtston"), p("amtston"), p("amtston"), p("ungefragt")]).join(), /3-mal/);
});

test("witz-muster.md ist aus witz-muster.json erzeugt", () => {
  assert.equal(fs.readFileSync(new URL("./witz-muster.md", import.meta.url), "utf8"), markdown());
});
