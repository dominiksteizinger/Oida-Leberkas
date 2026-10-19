import { test } from "node:test";
import assert from "node:assert/strict";
import { anlaesse, googleLesen, redditLesen } from "./trends.mjs";

test("Google-Trends-RSS: Suchbegriff, Menge und erste Schlagzeile", () => {
  const xml = `<rss><channel><title>Daily Search Trends</title><item><title>Zeitumstellung</title><ht:approx_traffic>20000+</ht:approx_traffic>
    <ht:news_item><ht:news_item_title><![CDATA[Uhren werden &amp; zurückgestellt]]></ht:news_item_title></ht:news_item>
    <ht:news_item><ht:news_item_title>Zweite</ht:news_item_title></ht:news_item></item><item><title>Nebel</title></item></channel></rss>`;
  assert.deepEqual(googleLesen(xml), ["Zeitumstellung (20000+ Suchen): Uhren werden & zurückgestellt", "Nebel"]);
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
