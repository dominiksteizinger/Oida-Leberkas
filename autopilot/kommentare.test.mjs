// Tests der Kommentar-Antworten: node --test autopilot/kommentare.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { einordnen, waehlen, planen, bericht, MAX_TAG, MAX_POST } from "./kommentare.mjs";
import { VERBOTEN } from "./wortfilter.mjs";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(fs.readFileSync(path.join(HIER, "antworten.json"), "utf8"));
const leer = () => ({ beantwortet: [], gemeldet: [] });
const k = (id, text, post = "p1", zeit = "2026-10-20T08:00:00Z") => ({ id, plattform: "ig", post, link: "https://instagram.com/p/x", text, zeit });

test("Pool: keine verbotenen Wörter, keine Doppelten, kurz", () => {
  const alle = Object.entries(pool).filter(([n]) => !n.startsWith("_")).flatMap(([, l]) => l);
  assert.ok(alle.length >= 70);
  assert.equal(new Set(alle).size, alle.length);
  for (const a of alle) {
    assert.ok(!VERBOTEN.test(a), a);
    assert.ok(a.length <= 70, `zu lang: ${a}`);
  }
});

test("Heikles wird nie beantwortet", () => {
  for (const [text, grund] of [
    ["Ist das KI?", /KI/], ["voll fake", /KI/], ["sexy 😍", /sexuell/], ["du hure", /Hass/],
    ["Meine Oma ist gestern gestorben", /Krise/], ["ich bin 13 und lieb das", /minderjährig/],
    ["Wählt alle FPÖ", /Politik/], ["Check my profile www.spam.com", /Link/], ["Kooperation? DM me", /Link/],
  ]) assert.match(einordnen(text).sperre || "", grund, text);
});

test("Harmloses bekommt die richtige Kategorie", () => {
  const f = (t) => einordnen(t).kategorie;
  assert.equal(f("😂😂😂"), "lachen");
  assert.equal(f("ich bin tot 💀"), "lachen");
  assert.equal(f("literally me jeden Montag"), "relatable");
  assert.equal(f("Ich bin so am Arsch, same"), "relatable");
  assert.equal(f("Liebe diesen Account 🖤"), "lob");
  assert.equal(f("Herbert ist so süß"), "herbert");
  assert.equal(f("Willst du mich heiraten?"), "flirt");
  assert.equal(f("cringe"), "kritik");
  assert.equal(f("@anna.m @max_12"), "markiert");
  assert.equal(f("Wie heißt du?"), undefined);
  assert.equal(einordnen("Wo ist das in Wien?").keine, "Frage");
  assert.equal(einordnen("Dreckswetter heute, mood").kategorie, "relatable");
  assert.equal(einordnen("Mir geht es schlecht").kategorie, undefined);
  assert.equal(einordnen("Ich bin ein Krebs, passt").sperre, undefined);
  assert.equal(einordnen("Moritz kennt das").sperre, undefined);
});

test("Antwort wird 30 Tage nicht wiederholt und nie zweimal unter einem Post", () => {
  const log = leer();
  const benutzt = new Set();
  for (let i = 0; i < pool.markiert.length; i++) {
    const a = waehlen(pool, "markiert", log, { post: `p${i}`, datum: "2026-10-20", id: `c${i}` });
    assert.ok(a && !benutzt.has(a));
    benutzt.add(a);
    log.beantwortet.push({ id: `c${i}`, post: `p${i}`, kat: "markiert", antwort: a, datum: "2026-10-20" });
  }
  assert.equal(waehlen(pool, "markiert", log, { post: "neu", datum: "2026-11-01", id: "x" }), null);
  assert.ok(waehlen(pool, "markiert", log, { post: "neu", datum: "2026-11-20", id: "x" }));
});

test("Limits pro Tag und pro Post, schon Erledigtes wird übersprungen", () => {
  const viele = Array.from({ length: 30 }, (_, i) => k(`c${i}`, "😂", `p${i % 5}`));
  const plan = planen(viele, leer(), pool, "2026-10-20");
  assert.equal(plan.antworten.length, Math.min(MAX_TAG, 5 * MAX_POST));
  const proPost = {};
  for (const a of plan.antworten) proPost[a.post] = (proPost[a.post] || 0) + 1;
  assert.ok(Object.values(proPost).every((n) => n <= MAX_POST));
  assert.equal(new Set(plan.antworten.map((a) => a.antwort)).size, plan.antworten.length);
  const log = { beantwortet: [{ id: "c0", post: "p0", kat: "lachen", antwort: "x", datum: "2026-10-19" }], gemeldet: ["c1"] };
  const zwei = planen([k("c0", "😂"), k("c1", "Ist das KI?"), k("c2", "Ist das KI?")], log, pool, "2026-10-20");
  assert.equal(zwei.antworten.length, 0);
  assert.deepEqual(zwei.melden.map((m) => m.id), ["c2"]);
});

test("Alte Kommentare bleiben liegen", () => {
  assert.equal(planen([k("alt", "😂", "p", "2026-09-01T08:00:00Z")], leer(), pool, "2026-10-20").antworten.length, 0);
});

test("Bericht zitiert Hass nicht und nennt keine Namen", () => {
  const b = bericht([{ ...k("a", "du hure"), grund: "Hass oder Beleidigung" }, { ...k("b", "@lisa ist das KI?"), grund: "Frage zu KI oder Echtheit" }], "2026-10-20");
  assert.ok(!b.includes("hure") && !b.includes("lisa"));
  assert.match(b, /bitte bald ansehen/);
  assert.equal(bericht([], "2026-10-20"), "");
});
