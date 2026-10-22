import { test } from "node:test";
import assert from "node:assert/strict";
import { zielgruppeLesen, pruefeZielgruppe, ue40Treffer, pruefeUe40, bericht } from "./zielgruppe.mjs";

const v = (zielgruppe, region = "dach") => ({ zielgruppe, region });

test("zielgruppe: Eingabe prüfen", () => {
  assert.deepEqual(zielgruppeLesen({}), { zielgruppe: null, region: "dach" });
  assert.deepEqual(zielgruppeLesen({ zielgruppe: "dating", region: "at" }), { zielgruppe: "dating", region: "at" });
  assert.throws(() => zielgruppeLesen({}, { pflicht: true }), /zielgruppe fehlt/);
  assert.throws(() => zielgruppeLesen({ zielgruppe: "rentner" }), /unbekannt/);
  assert.throws(() => zielgruppeLesen({ zielgruppe: "dating", region: "ch" }), /region/);
  assert.throws(() => zielgruppeLesen({ zielgruppe: "dating", ue40_ok: "ja" }), /Begründung/);
});

test("Quote: höchstens 2 gleiche hintereinander", () => {
  assert.equal(pruefeZielgruppe([v("dating"), v("dating")], v("dating")).ok, false);
  assert.equal(pruefeZielgruppe([v("dating"), v("jobstart")], v("dating")).ok, true);
});

test("Quote: Höchstzahl pro 14 Posts je Zielgruppe", () => {
  const verlauf = [v("dating"), v("akku"), v("dating"), v("wohnen"), v("dating"), v("studium"), v("dating"), v("akku"), v("dating"), v("wohnen")];
  assert.equal(pruefeZielgruppe(verlauf, v("dating")).ok, false); // 6. dating, erlaubt 5
  assert.equal(pruefeZielgruppe(verlauf.slice(0, 6), v("dating")).ok, true); // 4. dating ok
  assert.equal(pruefeZielgruppe([v("familie"), v("akku"), v("familie")], v("familie")).ok, false); // familie max 2
  assert.equal(pruefeZielgruppe([v("akku")], v("wohnen")).ok, true);
});

test("Quote: Region at/de höchstens 2 pro 14", () => {
  const verlauf = [v("akku", "at"), v("dating"), v("wohnen", "at")];
  assert.equal(pruefeZielgruppe(verlauf, v("jobstart", "at")).ok, false);
  assert.equal(pruefeZielgruppe(verlauf, v("jobstart", "de")).ok, true);
  assert.equal(pruefeZielgruppe(verlauf, v("jobstart")).ok, true);
});

test("Quote: Posts ohne Zielgruppe zählen nicht", () => {
  assert.equal(pruefeZielgruppe([v("dating"), v("dating")], v(null)).ok, true);
});

test("Ü40-Warnliste", () => {
  assert.deepEqual(ue40Treffer({ inhalt: { text: "Antwort an den Mailverteiler" } }), ["Mailverteiler"]);
  assert.deepEqual(ue40Treffer({ caption: "Wichteln im Büro", inhalt: { text: "Weihnachtsfeier" } }), ["Wichteln", "Weihnachtsfeier"]);
  assert.deepEqual(ue40Treffer({ inhalt: { text: "Mach keine Faxen" } }), []);
  assert.deepEqual(ue40Treffer({ inhalt: { text: "Die Pension in Grado" } }), []);
  assert.deepEqual(ue40Treffer({ bild: "fax.jpg", trend: "Fax" }), []); // technische Felder zählen nicht
  assert.throws(() => pruefeUe40({ inhalt: { text: "Kaffeekasse leer" } }), /Ü40/);
  assert.doesNotThrow(() => pruefeUe40({ inhalt: { text: "Kaffeekasse leer" }, ue40_ok: "Resi ist neu und versteht das System nicht." }));
});

test("Bericht zählt Zielgruppen, Regionen und Ü40", () => {
  const md = bericht([
    { nr: 1, titel: "A", post: { zielgruppe: "dating" } },
    { nr: 2, titel: "B", post: { zielgruppe: "dating", region: "at" } },
    { nr: 3, titel: "C", post: { inhalt: { text: "Wichteln" } } },
  ]);
  assert.match(md, /Dating, Beziehung und Ex \(dating\) \| 2 \| 67 %/);
  assert.match(md, /ohne Zielgruppe \| 1/);
  assert.match(md, /- at: 1/);
  assert.match(md, /#3 C: Wichteln/);
});

test("Auswahl: Anlass zuerst, dann größter Bedarf, dann Warteschlange", async () => {
  const { sortiereKandidaten, bedarf } = await import("./zielgruppe.mjs");
  const verlauf = [v("jobstart"), v("jobstart"), v("akku")];
  assert.equal(bedarf(verlauf, "jobstart"), 1);
  assert.equal(bedarf(verlauf, "dating"), 5);
  assert.equal(bedarf(verlauf, null), 0);
  const k = [
    { name: "alt-job", zielgruppe: "jobstart", rang: 0 },
    { name: "ohne", zielgruppe: null, rang: 1 },
    { name: "dating", zielgruppe: "dating", rang: 2 },
    { name: "anlass", zielgruppe: "jobstart", rang: 3, datiert: true },
  ];
  assert.deepEqual(sortiereKandidaten(k, verlauf).map((x) => x.name), ["anlass", "dating", "alt-job", "ohne"]);
});
