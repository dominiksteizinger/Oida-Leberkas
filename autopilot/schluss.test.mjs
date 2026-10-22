import { test } from "node:test";
import assert from "node:assert/strict";
import { pruefeSchluss, setupUndSchluss } from "./schluss.mjs";

const szene = (satz, klammern, extra = {}) => ({ inhalt: { format: "szene", satz, klammern }, mechanik: "umdeutung", ...extra });

test("Gute Pointen aus der Warteschlange gehen durch", () => {
  assert.deepEqual(pruefeSchluss(szene("Mädelsabend. Alle hassen ihren Freund.", ["Ich hab keinen.", "Ich hasse trotzdem mit.", "Am meisten den von Lena."])), []);
  assert.deepEqual(pruefeSchluss(szene("Ärztin: „Bewegen Sie sich genug?“", ["Ich jogge jeden Morgen.", "„Wo denn?“", "Friedhof. Da überholt mich keiner."])), []);
  assert.deepEqual(pruefeSchluss(szene("„Ich hol nur schnell Milch.“", ["Milch: vergessen.", "Kerzen: 40."])), []);
  const chat = { mechanik: "absage", inhalt: { format: "chat", name: "Jonas", nachrichten: [{ wer: "sie", text: "Was suchst du hier?" }, { wer: "ich", text: "Ruhe." }, { wer: "sie", text: "Da bist du bei mir richtig" }, { wer: "ich", text: "Nein." }] } };
  assert.deepEqual(pruefeSchluss(chat), []);
});

test("Schluss als bloße Reaktion oder Wiederholung fällt durch (von Dominik verworfen)", () => {
  assert.match(pruefeSchluss(szene("Lena hasst ihren Freund. Ich hasse mit.", ["Am nächsten Tag haben sie sich versöhnt.", "Ich nicht."]))[0], /kein neues konkretes Wort/);
  assert.match(pruefeSchluss(szene("Nina hat Schluss gemacht. Ich hab ihn sofort überall blockiert.", ["Heute sind sie wieder zusammen.", "Er ist noch blockiert."]))[0], /kein neues konkretes Wort/);
});

test("Zustand, Frage, Trendwort, Länge, Gegenüber", () => {
  const todo = { inhalt: { format: "todo", titel: "Mülltrennung", punkte: [{ text: "Papier", erledigt: true }, { text: "Plastik", erledigt: true }, { text: "Altglas", erledigt: false }], fazit: "Es ist jetzt Deko." } };
  assert.match(pruefeSchluss(todo)[0], /Zustand/);
  assert.ok(pruefeSchluss(szene("Er schreibt nicht zurück.", ["Kommt er wieder?"])).some((f) => /Frage/.test(f)));
  assert.ok(pruefeSchluss(szene("Er kaut laut.", ["Das ist mein Ick."])).some((f) => /Trendwort/.test(f)));
  assert.ok(pruefeSchluss(szene("Er fragt nach meiner Nummer.", ["Ich gebe ihm die Nummer vom Bestatter meines Vertrauens."]), { mechanik: "absage" }).some((f) => /Wörter/.test(f)));
  assert.ok(pruefeSchluss(szene("Friseurin: „Was machen wir heute?“", ["Wie immer.", "„Also schwarz?“"])).some((f) => /Gegenüber/.test(f)));
  assert.ok(pruefeSchluss(szene("Date.", ["Er: „Ich zahl.“"])).some((f) => /Gegenüber/.test(f)));
  assert.deepEqual(pruefeSchluss(szene("Date.", ["Ich: „Nicht interessiert. 1,65.“"])), []);
});

test("schluss_ok mit Begründung lässt durch, Formate ohne klare letzte Zeile werden nicht geprüft", () => {
  assert.deepEqual(pruefeSchluss(szene("Lena hasst ihren Freund.", ["Ich nicht."], { schluss_ok: "Kippt, weil Resi gar keinen Freund hat." })), []);
  assert.equal(setupUndSchluss({ format: "wiedergabe", titel: "x" }), null);
  assert.equal(setupUndSchluss({ format: "storyfrage", frage: "Wie geht es dir?", antwort: "Ruhig." }).schluss, "Ruhig.");
});
