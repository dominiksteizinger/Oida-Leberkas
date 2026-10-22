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
test("Quote: Höchstzahl in 14 je Mechanik", () => {
  const v = ["absage", null, "absage", null, "absage", null, "absage", null, "absage", null, "absage", null, null];
  assert.equal(pruefeQuote(v, "absage").ok, false);
  assert.equal(pruefeQuote(["absage", ...v.slice(1)], "absage").ok, false);
  assert.equal(pruefeQuote([null, null, null, ...v.slice(3)], "absage").ok, true);
  assert.equal(pruefeQuote(["kontrast", null, "kontrast", null, "kontrast"], "kontrast").ok, false); // kontrast max 3
  assert.equal(pruefeQuote(["unbekannt", null, "unbekannt", null, "unbekannt"], "unbekannt").ok, false); // alte Tags: 3
});
test("Quote: Posts ohne Tag zählen nicht", () => assert.equal(pruefeQuote(["absage", "absage", "absage"], null).ok, true));
test("mechanik: Eingabe prüfen", () => {
  assert.equal(mechanikLesen({}), null);
  assert.equal(mechanikLesen({ mechanik: "absage" }), "absage");
  assert.throws(() => mechanikLesen({ mechanik: "Resi sagt Nein" }));
  assert.throws(() => mechanikLesen({}, { pflicht: true }), /fehlt/);
  assert.throws(() => mechanikLesen({ mechanik: "witzig" }, { pflicht: true }), /unbekannt/);
  assert.equal(mechanikLesen({ mechanik: "ertappt" }, { pflicht: true }), "ertappt");
});
test("Mischung: Selbstironie und Beziehung je mindestens 40 % ab 6 Posts", async () => {
  const { pruefeMischung } = await import("./humorquote.mjs");
  const p = (mechanik, zielgruppe) => ({ mechanik, zielgruppe });
  assert.deepEqual(pruefeMischung([p("absage", "alltag")]), []);
  const gut = [p("ertappt", "dating"), p("kontrast", "familie"), p("gestaendnis", "akku"), p("absage", "dating"), p("woertlich", "alltag"), p("umdeutung", "wohnen")];
  assert.deepEqual(pruefeMischung(gut), []);
  const flach = gut.map((x) => ({ ...x, mechanik: "umdeutung", zielgruppe: "alltag" }));
  assert.equal(pruefeMischung(flach).length, 2);
});
