import test from "node:test";
import assert from "node:assert/strict";
import { fehlerartVon, grundEintrag, haeufigste } from "./fehlerarten.mjs";
import { pruefeSchluss } from "./schluss.mjs";

test("Fehlerarten: automatische Meldungen werden zugeordnet", () => {
  const flach = pruefeSchluss({ mechanik: "umdeutung", inhalt: { format: "szene", satz: "Nebel über Wien.", klammern: ["Es ist jetzt Deko."] } });
  assert.ok(flach.length);
  assert.ok(flach.map(fehlerartVon).includes("flach"));
  assert.equal(fehlerartVon("klingt nach Ü40 (Kantine)"), "ue40");
  assert.equal(fehlerartVon("Bild x.jpg ist ein Sticker (art: figur): im szene-Format ist der Kopf abgeschnitten"), "bild_passt_nicht");
  assert.equal(fehlerartVon("irgendwas anderes"), null);
});

test("Fehlerarten: Eintrag prüfen, häufigste Gründe gewichtet", () => {
  assert.throws(() => grundEintrag({ datum: "2026-10-22", quelle: "gegenleser", post: "#1", art: "unlustig" }));
  const g = [
    grundEintrag({ datum: "2026-10-20", quelle: "gegenleser", post: "#1", art: "vorwissen", schluss: "ok." }),
    grundEintrag({ datum: "2026-10-21", quelle: "gegenleser", post: "#2", art: "vorwissen" }),
    grundEintrag({ datum: "2026-10-21", quelle: "flop", post: "2026-10-21-07", art: "flach", schluss: "Es ist jetzt Deko." }),
    grundEintrag({ datum: "2026-10-21", quelle: "dominik", post: "#3", art: "flach" }),
    grundEintrag({ datum: "2026-08-01", quelle: "dominik", post: "#0", art: "ue40" }),
  ];
  const h = haeufigste(g, { heute: "2026-10-22" });
  assert.deepEqual(h.map((x) => [x.art, x.gewicht]), [["flach", 4], ["vorwissen", 2]]);
  assert.deepEqual(h[0].beispiele, ["Es ist jetzt Deko."]);
});
