import test from "node:test";
import assert from "node:assert/strict";
import { wortfilter } from "./wortfilter.mjs";
import { pruefeQuote, mechanikLesen } from "./humorquote.mjs";

const basis = { inhalt: { format: "szene", satz: "Montag.", klammern: ["still"] }, bild: "beisst-semmel.jpg", caption: "Alltag.", aufforderung: "Speichern.", hashtags: ["#deadpan"] };

test("sauberer Post, Bildname mit Semmel ist erlaubt", () => assert.deepEqual(wortfilter(basis), []));
test("findet Leberkäse und Semmel in Text, Caption, Hashtags und Namen", () => {
  assert.equal(wortfilter({ ...basis, caption: "Leberkäse!" }).length, 1);
  assert.equal(wortfilter({ ...basis, hashtags: ["#leberkässemmel"] })[0].feld, "hashtags[0]");
  assert.equal(wortfilter({ ...basis, inhalt: { format: "antwort", von: "leberkas.fan", kommentar: "x", zeilen: ["Eine Semmel."] } }).length, 2);
  assert.equal(wortfilter({ ...basis, caption: "🦇🥖" }).length, 1);
  assert.equal(wortfilter({ ...basis, aufforderung: "LEBERKAS" }).length, 1);
});

test("Quote: höchstens 2 hintereinander", () => {
  assert.equal(pruefeQuote(["absage", "absage"], "absage").ok, false);
  assert.equal(pruefeQuote([null, "absage"], "absage").ok, true);
  assert.equal(pruefeQuote(["absage", "absage"], "serie").ok, true);
});
test("Quote: höchstens 3 in 14", () => {
  const v = ["absage", null, "absage", null, "absage", null, null, null, null, null, null, null, null];
  assert.equal(pruefeQuote(v, "absage").ok, false);
  assert.equal(pruefeQuote(["absage", ...v.slice(1)], "absage").ok, false);
  assert.equal(pruefeQuote([null, null, null, ...v.slice(3)], "absage").ok, true);
});
test("Quote: Posts ohne Tag zählen nicht", () => assert.equal(pruefeQuote(["absage", "absage", "absage"], null).ok, true));
test("mechanik: Eingabe prüfen", () => {
  assert.equal(mechanikLesen({}), null);
  assert.equal(mechanikLesen({ mechanik: "absage" }), "absage");
  assert.throws(() => mechanikLesen({ mechanik: "Resi sagt Nein" }));
});
