import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { bildMass, pruefeAusschnitt } from "./ausschnitt.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const bibliothek = JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8"));
const szene = { inhalt: { format: "szene", satz: "x", klammern: ["y"] } };
const pruefe = (post, datei) => {
  const b = bibliothek.find((x) => x.datei === datei);
  return pruefeAusschnitt(post, b, bildMass(path.join(HIER, "bilder", datei)));
};

test("Bildgröße aus JPEG-Kopf", () => {
  assert.deepEqual(bildMass(path.join(HIER, "bilder", "grantig-arme.jpg")), { breite: 687, hoehe: 1024 });
});

test("Sticker im szene-Format: Kopf ab, im antwort-Format in Ordnung", () => {
  assert.match(pruefe(szene, "grantig-arme.jpg")[0], /Sticker/);
  assert.deepEqual(pruefe({ inhalt: { format: "antwort" } }, "grantig-arme.jpg"), []);
});

test("Alle Szenen der Bibliothek mit kopf zeigen den Kopf im szene-Format", () => {
  for (const b of bibliothek.filter((x) => x.art === "szene")) assert.deepEqual(pruefe(szene, b.datei), [], b.datei);
});

test("Hochformat ohne kopf oder Kopf außerhalb des Streifens fällt durch", () => {
  const b = { datei: "t.jpg", art: "szene" };
  assert.match(pruefeAusschnitt(szene, b, { breite: 1080, hoehe: 1920 })[0], /ohne kopf/);
  assert.deepEqual(pruefeAusschnitt(szene, b, { breite: 1024, hoehe: 572 }), []);
  assert.match(pruefeAusschnitt(szene, { ...b, kopf: [0.5, 0.95] }, { breite: 1080, hoehe: 1920 })[0], /nicht ganz/);
});
