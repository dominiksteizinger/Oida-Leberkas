import { test } from "node:test";
import assert from "node:assert/strict";
import { anlaesse, googleLesen, redditLesen, ferienLesen, schnellQuellen } from "./trends.mjs";

test("Google-Trends-RSS: Suchbegriff, Menge und erste Schlagzeile", () => {
  const xml = `<rss><channel><title>Daily Search Trends</title><item><title>Zeitumstellung</title><ht:approx_traffic>20000+</ht:approx_traffic>
    <ht:news_item><ht:news_item_title><![CDATA[Uhren werden &amp; zurückgestellt]]></ht:news_item_title></ht:news_item>
    <ht:news_item><ht:news_item_title>Zweite</ht:news_item_title></ht:news_item></item><item><title>Axel &apos;s</title></item></channel></rss>`;
  assert.deepEqual(googleLesen(xml), ["Zeitumstellung (20000+ Suchen): Uhren werden & zurückgestellt", "Axel 's"]);
});

test("Reddit-Atom: nur Eintragstitel, nicht der Feedtitel", () => {
  const xml = `<feed><title>top scoring links : wien</title><entry><title>Nebel über der Donauinsel</title></entry><entry><title>Bim &amp; Regen</title></entry></feed>`;
  assert.deepEqual(redditLesen(xml), ["Nebel über der Donauinsel", "Bim & Regen"]);
});

test("Anlässe: 21 Tage, ohne doppelte Vorwarnung", () => {
  const liste = anlaesse("2026-10-19");
  assert.ok(liste.some((z) => z.startsWith("2026-11-01: Allerheiligen")));
  assert.ok(!liste.some((z) => z.includes("(in ")));
  assert.ok(!liste.some((z) => z.startsWith("2026-11-09")));
});

test("Schulferien: Zeitraum und deutscher Name", () => {
  const liste = [{ startDate: "2026-10-26", endDate: "2026-11-02", name: [{ language: "EN", text: "Autumn holidays" }, { language: "DE", text: "Herbstferien" }] }];
  assert.deepEqual(ferienLesen(liste), ["2026-10-26 bis 2026-11-02: Herbstferien"]);
  const zwei = [
    { startDate: "2026-11-02", endDate: "2026-11-06", name: [{ language: "DE", text: "Herbstferien" }], subdivisions: [{ code: "DE-BY", shortName: "BY" }] },
    { startDate: "2026-10-26", endDate: "2026-10-31", name: [{ language: "DE", text: "Herbstferien" }], subdivisions: [{ code: "DE-NW", shortName: "NW" }] },
    { startDate: "2026-11-02", endDate: "2026-11-06", name: [{ language: "DE", text: "Herbstferien" }], subdivisions: [{ code: "DE-BW", shortName: "BW" }] },
  ];
  assert.deepEqual(ferienLesen(zwei), ["2026-10-26 bis 2026-10-31: Herbstferien (NW)", "2026-11-02 bis 2026-11-06: Herbstferien (BY, BW)"]);
});

test("Schnellweg: Kurzlauf ohne langsame Wochenquellen, Anlässe nur 3 Tage", () => {
  const namen = schnellQuellen("2026-10-20").map(([n]) => n);
  assert.ok(namen.some((n) => n.startsWith("Google Trends Deutschland")));
  assert.ok(namen.some((n) => n.includes("Top des Tages")));
  assert.ok(!namen.some((n) => /Schulferien|Kuriose|Kommentare/.test(n)));
  assert.equal(namen.filter((n) => n.startsWith("Reddit")).length, 4);
  assert.ok(anlaesse("2026-10-30", 3).some((z) => z.startsWith("2026-11-01")));
  assert.ok(!anlaesse("2026-10-30", 3).some((z) => z.startsWith("2026-11-02")));
});

test("Dating-Shorts: nur deutschsprachige Titel", async () => {
  const { deutsch } = await import("./trends.mjs");
  assert.equal(deutsch("Wer ist eure Beifahrer Princess? #beziehung"), true);
  assert.equal(deutsch("Dieses Mädchen zeigte ihrer besten Freundin ihren Gym-Crush"), true);
  assert.equal(deutsch("I Tried to Hide My Farts on Our Date!"), false);
  assert.equal(deutsch("Going on a date with Link"), false);
});
