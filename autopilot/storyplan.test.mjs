import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { slotFuer, lageAus, offeneKarten, waehleMittag, waehleHinweis, waehleBild, pruefeVorrat, wetterKarte } from "./storyplan.mjs";

const HIER = new URL(".", import.meta.url).pathname;
const vorrat = (karten) => ({ hinweise: ["a", "b", "c"], wetter: { sonne: [{ gefuehlt: "x", zusatz: "y" }], wolken: [{ gefuehlt: "x", zusatz: "y" }], nebel: [{ gefuehlt: "n1", zusatz: "y" }, { gefuehlt: "n2", zusatz: "y" }], regen: [{ gefuehlt: "x", zusatz: "y" }], schnee: [], gewitter: [], hitze: [], frost: [] }, karten });
const notiz = (id, extra = {}) => ({ id, inhalt: { format: "notiz", titel: "T", absaetze: ["a", "b"] }, ...extra });

test("Slots nach Wiener Stunde", () => {
  assert.equal(slotFuer(10), null);
  assert.equal(slotFuer(11), "mittag");
  assert.equal(slotFuer(15), "mittag");
  assert.equal(slotFuer(16), "abend");
  assert.equal(slotFuer(17), "abend");
  assert.equal(slotFuer(23), "abend");
  assert.equal(slotFuer(7), null);
});

test("Lage aus Wetterdaten", () => {
  assert.equal(lageAus({ code: 0, max: 15, min: 5 }), "sonne");
  assert.equal(lageAus({ code: 3, max: 15, min: 5 }), "wolken");
  assert.equal(lageAus({ code: 45, max: 9, min: 2 }), "nebel");
  assert.equal(lageAus({ code: 61, max: 9, min: 2 }), "regen");
  assert.equal(lageAus({ code: 73, max: 0, min: -5 }), "schnee");
  assert.equal(lageAus({ code: 0, max: 31, min: 18 }), "hitze");
  assert.equal(lageAus({ code: 0, max: 1, min: -6 }), "frost");
});

test("Jede Karte nur einmal, Anlass zuerst, Zeitraum beachtet", () => {
  const karten = [notiz("a"), notiz("b"), notiz("anlass", { ab: "2026-10-30", bis: "2026-10-31" })];
  assert.deepEqual(offeneKarten(karten, [], "2026-10-20").map((k) => k.id), ["a", "b"]);
  assert.deepEqual(offeneKarten(karten, [{ karte: "a" }], "2026-10-31").map((k) => k.id), ["anlass", "b"]);
  assert.deepEqual(offeneKarten(karten, [], "2026-11-01").map((k) => k.id), ["a", "b"]);
});

test("Wochentag: Karte nur an ihren Tagen, Wochentag im Text braucht tage", () => {
  const karten = [notiz("mo", { tage: ["Montag"] }), notiz("frei")];
  // 2026-10-19 ist Montag, 2026-10-20 Dienstag
  assert.deepEqual(offeneKarten(karten, [], "2026-10-19").map((k) => k.id), ["mo", "frei"]);
  assert.deepEqual(offeneKarten(karten, [], "2026-10-20").map((k) => k.id), ["frei"]);
  const bib = [];
  const roh = JSON.parse(fs.readFileSync(`${HIER}storys.json`, "utf8"));
  const montag = { id: "m", inhalt: { format: "notiz", titel: "Es ist Montag", absaetze: ["a", "b"] } };
  assert.ok(pruefeVorrat({ ...roh, karten: [montag] }, bib).some((f) => f.includes("Wochentag")));
  assert.deepEqual(pruefeVorrat({ ...roh, karten: [{ ...montag, tage: ["Montag"] }] }, bib), []);
  assert.deepEqual(pruefeVorrat({ ...roh, karten: [{ ...montag, tage: "alle" }] }, bib), []);
});

test("Mittag: Wetter nur an auffälligen Tagen und höchstens alle 3 Tage", () => {
  const v = vorrat([notiz("a")]);
  assert.equal(waehleMittag({ vorrat: v, log: [], datum: "2026-10-20", wetter: { code: 0, max: 15, min: 5 } }).art, "karte");
  assert.equal(waehleMittag({ vorrat: v, log: [], datum: "2026-10-20", wetter: { code: 45, max: 9, min: 2 } }).art, "wetter");
  const log = [{ datum: "2026-10-19", wetter: "nebel-0" }];
  assert.equal(waehleMittag({ vorrat: v, log, datum: "2026-10-20", wetter: { code: 45, max: 9, min: 2 } }).art, "karte");
  // Anlass schlägt Wetter
  const mitAnlass = vorrat([notiz("a"), notiz("x", { bis: "2026-10-20" })]);
  assert.equal(waehleMittag({ vorrat: mitAnlass, log: [], datum: "2026-10-20", wetter: { code: 61, max: 9, min: 2 } }).karte.id, "x");
  // Vorrat leer: Wetter als Ersatz, sonst nichts
  assert.equal(waehleMittag({ vorrat: vorrat([]), log: [], datum: "2026-10-20", wetter: { code: 0, max: 15, min: 5 } }).art, "wetter");
  assert.equal(waehleMittag({ vorrat: vorrat([]), log: [], datum: "2026-10-20", wetter: null }), null);
});

test("Wetterzeilen und Hinweise wechseln durch", () => {
  const v = vorrat([]);
  const w1 = wetterKarte({ code: 45, max: 9.4, min: 2 }, v, [], "2026-10-20");
  assert.equal(w1.inhalt.gefuehlt, "n1");
  assert.equal(w1.inhalt.temperatur, "9°");
  assert.equal(wetterKarte({ code: 45, max: 9, min: 2 }, v, [{ datum: "2026-10-20", wetter: "nebel-0" }], "2026-10-24").inhalt.gefuehlt, "n2");
  assert.equal(waehleHinweis(["a", "b", "c"], []), 0);
  assert.equal(waehleHinweis(["a", "b", "c"], [{ datum: "2026-10-19", hinweis: 0 }, { datum: "2026-10-20", hinweis: 1 }]), 2);
});

test("Bildwahl: keine Bilder aus den letzten Posts und Storys, keine einmaligen Anlassbilder", () => {
  const bib = [
    { datei: "a.jpg", art: "szene", tags: ["neutral"], gesicht: "ja", kopf: [0.5, 0.3] },
    { datei: "b.jpg", art: "szene", tags: ["neutral"], gesicht: "ja", kopf: [0.5, 0.3] },
    { datei: "c.jpg", art: "szene", tags: ["halloween"], gesicht: "ja", kopf: [0.5, 0.3] },
    { datei: "quer.jpg", art: "szene", tags: ["neutral"], gesicht: "ja" },
  ];
  assert.equal(waehleBild({ bibliothek: bib, nutzung: [], log: [], datum: "2026-10-30" }), "a.jpg");
  assert.equal(waehleBild({ bibliothek: bib, nutzung: [{ datum: "2026-10-29", bild: "a.jpg" }], log: [], datum: "2026-10-30" }), "b.jpg");
  assert.equal(waehleBild({ bibliothek: bib, nutzung: [{ datum: "2026-10-29", bild: "a.jpg" }], log: [{ datum: "2026-10-25", bild: "b.jpg" }], datum: "2026-10-30" }), null);
});

test("storys.json im Repo ist gültig", () => {
  const roh = JSON.parse(fs.readFileSync(`${HIER}storys.json`, "utf8"));
  const bib = JSON.parse(fs.readFileSync(`${HIER}bibliothek.json`, "utf8"));
  assert.deepEqual(pruefeVorrat(roh, bib), []);
  assert.ok(pruefeVorrat({ ...roh, karten: [notiz("x"), notiz("x")] }, bib).some((f) => f.includes("doppelt")));
  assert.ok(pruefeVorrat({ ...roh, karten: [{ id: "y", inhalt: { format: "notiz", titel: "Semmel", absaetze: ["a", "b"] } }] }, bib).some((f) => f.includes("verbotenes Wort")));
});
