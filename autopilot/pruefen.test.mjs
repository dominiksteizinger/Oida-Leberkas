import { test } from "node:test";
import assert from "node:assert/strict";
import { pruefeAlle } from "./pruefen.mjs";

const szene = (extra = {}) => ({ titel: "Post 99 (szene): Test", inhalt: { format: "szene", satz: "Montag.", klammern: ["Kalender gelöscht."] }, bild: "buero-montag.jpg", caption: "Montag.", hashtags: ["#wien"], zielgruppe: "jobstart", mechanik: "ertappt", annahme: "Montag ist schlimm", ...extra });

test("gültiger Post ergibt Issue-Text mit JSON-Block, ohne titel und notiz", () => {
  const [r] = pruefeAlle([szene({ notiz: "Trend-Post." })], [], "2026-10-19");
  assert.deepEqual(r.fehler, []);
  assert.equal(r.issue.title, "Post 99 (szene): Test");
  assert.match(r.issue.body, /^Trend-Post\.\n\n```json\n\{"inhalt"/);
  assert.doesNotMatch(r.issue.body, /"titel"|"notiz"/);
});

test("Wortfilter, unbekanntes Bild, kaputtes Datum", () => {
  const [r] = pruefeAlle([szene({ caption: "Semmel", bild: "gibtsnicht.jpg", bis: "2026-1-1" })], [], "2026-10-19");
  assert.equal(r.fehler.length, 3);
});

test("Bild schon in der Warteschlange oder doppelt im Satz", () => {
  const offen = [{ number: 50, body: "x\n```json\n{\"bild\":\"buero-montag.jpg\"}\n```" }];
  assert.match(pruefeAlle([szene()], offen, "2026-10-19")[0].fehler.join(), /#50/);
  const r = pruefeAlle([szene(), szene({ titel: "zwei" })], [], "2026-10-19");
  assert.deepEqual(r[0].fehler, []);
  assert.match(r[1].fehler.join(), /neuem Post 1/);
});

test("Anlassbild braucht ab/bis im Zeitraum, Saisonbild muss bis zum Horizont passen", () => {
  assert.match(pruefeAlle([szene({ bild: "allerheiligen-grablicht.jpg" })], [], "2026-10-19")[0].fehler.join(), /Anlassbild/);
  assert.deepEqual(pruefeAlle([szene({ bild: "allerheiligen-grablicht.jpg", ab: "2026-11-01", bis: "2026-11-02" })], [], "2026-10-19")[0].fehler, []);
  assert.match(pruefeAlle([szene({ bild: "herbstlaub-strasse.jpg" })], [], "2026-11-10")[0].fehler.join(), /passt am/);
  assert.deepEqual(pruefeAlle([szene({ bild: "herbstlaub-strasse.jpg", bis: "2026-11-30" })], [], "2026-11-10")[0].fehler, []);
});

test("Format ohne Bild nur bei notiz und chat; bis in der Vergangenheit", () => {
  const ohne = szene(); delete ohne.bild;
  assert.match(pruefeAlle([ohne], [], "2026-10-19")[0].fehler.join(), /braucht ein Bild/);
  assert.match(pruefeAlle([szene({ bis: "2026-10-01" })], [], "2026-10-19")[0].fehler.join(), /Vergangenheit/);
});

test("Zielgruppe ist Pflicht, Ü40 nur mit Begründung", () => {
  assert.match(pruefeAlle([szene({ zielgruppe: undefined })], [], "2026-10-19")[0].fehler.join(), /zielgruppe fehlt/);
  assert.match(pruefeAlle([szene({ mechanik: undefined })], [], "2026-10-19")[0].fehler.join(), /mechanik fehlt/);
  assert.match(pruefeAlle([szene({ annahme: undefined })], [], "2026-10-19")[0].fehler.join(), /annahme fehlt/);
  assert.match(pruefeAlle([szene({ inhalt: { format: "bewertung", nr: 1, ort: "Bim", saerge: 2, text: "Eng." } })], [], "2026-10-19")[0].fehler.join(), /Ortsbewertungen/);
  const chat = { format: "chat", name: "Lea", nachrichten: [{ wer: "ich", text: "Ja." }, { wer: "sie", text: "Und?" }, { wer: "sie", text: "Hallo?" }] };
  assert.match(pruefeAlle([szene({ bild: undefined, inhalt: chat })], [], "2026-10-19")[0].fehler.join(), /letzte Wort/);
  assert.match(pruefeAlle([szene({ caption: "Wichteln." })], [], "2026-10-19")[0].fehler.join(), /Ü40/);
  assert.deepEqual(pruefeAlle([szene({ caption: "Wichteln.", ue40_ok: "Resi wichtelt zum ersten Mal mit der WG." })], [], "2026-10-19")[0].fehler, []);
});
