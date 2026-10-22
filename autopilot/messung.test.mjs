import test from "node:test";
import assert from "node:assert/strict";
import { instagram, youtube, bericht, aufforderungsArt, youtubeTitel } from "./messung.mjs";
import { captionText } from "./eintrag.mjs";

const e = { id: "2026-10-19-07", slot: "07", inhalt: { format: "szene", satz: "Montag.", klammern: ["still"] }, caption: "Alltag.", aufforderung: "Schick das jemandem.", hashtags: ["#deadpan"] };
const posts = [{ id: e.id, e, gepostetAm: new Date(), art: aufforderungsArt(e.aufforderung) }];
const json = (j, ok = true) => ({ ok, json: async () => j });

test("Instagram ohne Token wird übersprungen", async () => {
  const r = await instagram({ token: "", igId: "1", posts, f: () => { throw new Error("kein Aufruf"); } });
  assert.equal(r.status, "uebersprungen");
});
test("Instagram: fehlende Berechtigung überspringt sauber", async () => {
  const f = async (url) => url.includes("/media?")
    ? json({ data: [{ id: "m1", caption: captionText(e), permalink: "https://ig/p/1" }] })
    : json({ error: { message: "(#10) Application does not have permission", code: 10 } });
  const r = await instagram({ token: "t", igId: "1", posts, f });
  assert.equal(r.status, "uebersprungen");
  assert.match(r.grund, /instagram_manage_insights/);
});
test("Instagram: unbekannte Metrik wird einzeln nachgeholt", async () => {
  const f = async (url) => {
    if (url.includes("/media?")) return json({ data: [{ id: "m1", caption: captionText(e), permalink: "https://ig/p/1" }] });
    const m = new URL(url).searchParams.get("metric");
    if (m.includes(",")) return json({ error: { message: "(#100) invalid metric", code: 100 } });
    if (m === "views") return json({ error: { message: "(#100) invalid metric", code: 100 } });
    return json({ data: [{ name: m, values: [{ value: 7 }] }] });
  };
  const r = await instagram({ token: "t", igId: "1", posts, f });
  assert.equal(r.status, "ok");
  assert.equal(r.werte[e.id].reach, 7);
  assert.equal(r.werte[e.id].views, undefined);
});
test("YouTube ohne Secrets oder ohne Scope wird übersprungen", async () => {
  assert.equal((await youtube({ env: {}, posts, von: "2026-10-01", bis: "2026-10-20" })).status, "uebersprungen");
  const f = async () => json({ access_token: "a", scope: "https://www.googleapis.com/auth/youtube.upload" });
  const r = await youtube({ env: { YOUTUBE_CLIENT_ID: "a", YOUTUBE_CLIENT_SECRET: "b", YOUTUBE_REFRESH_TOKEN: "c" }, posts, von: "2026-10-01", bis: "2026-10-20", f });
  assert.match(r.grund, /yt-analytics/);
});
test("YouTube ordnet Videos über den Titel zu", async () => {
  const f = async (url) => {
    if (url.includes("oauth2")) return json({ access_token: "a", scope: "yt-analytics.readonly youtube.readonly youtube.upload" });
    if (url.includes("youtubeanalytics")) return json({ columnHeaders: [{ name: "video" }, { name: "views" }, { name: "averageViewDuration" }], rows: [["v1", 120, 6.5], ["v2", 5, 3]] });
    return json({ items: [{ id: "v1", snippet: { title: youtubeTitel(e) } }, { id: "v2", snippet: { title: "Fremd" } }] });
  };
  const yt = await youtube({ env: { YOUTUBE_CLIENT_ID: "a", YOUTUBE_CLIENT_SECRET: "b", YOUTUBE_REFRESH_TOKEN: "c" }, posts, von: "2026-10-01", bis: "2026-10-20", f });
  assert.equal(yt.werte[e.id].views, 120);
  assert.equal(yt.rest.length, 1);
  const text = bericht({ datum: "2026-10-20", tage: 28, posts, ig: { status: "uebersprungen", grund: "x" }, yt });
  assert.match(text, /\| 2026-10-19-07 /);
  assert.match(text, /Instagram: \*\*übersprungen\*\*/);
});
test("Bericht bei zwei übersprungenen Quellen bricht nicht", () => {
  const text = bericht({ datum: "2026-10-20", tage: 28, posts, ig: { status: "uebersprungen", grund: "a" }, yt: { status: "uebersprungen", grund: "b" } });
  assert.match(text, /YouTube: \*\*übersprungen\*\*/);
});

test("YouTube: ohne Analytics-Zeile vorläufige Zähler aus der Data API", async () => {
  const f = async (url) => {
    if (url.includes("oauth2")) return json({ access_token: "a", scope: "yt-analytics.readonly youtube.readonly" });
    if (url.includes("youtubeanalytics")) return json({ columnHeaders: [{ name: "video" }, { name: "views" }], rows: [] });
    if (url.includes("/channels")) return json({ items: [{ contentDetails: { relatedPlaylists: { uploads: "UU1" } } }] });
    if (url.includes("/playlistItems")) return json({ items: [{ contentDetails: { videoId: "v9" } }] });
    return json({ items: [{ id: "v9", snippet: { title: youtubeTitel(e) }, statistics: { viewCount: "42", likeCount: "3" } }] });
  };
  const yt = await youtube({ env: { YOUTUBE_CLIENT_ID: "a", YOUTUBE_CLIENT_SECRET: "b", YOUTUBE_REFRESH_TOKEN: "c" }, posts, von: "2026-10-01", bis: "2026-10-20", f });
  assert.equal(yt.werte[e.id].views, 42);
  assert.equal(yt.vorlaeufig, 1);
});

test("Kurzfassung: Top/Flop nach Punkten, Signal erst ab 2 Posts, Fehler-Check auf gepostete Posts", async () => {
  const { kurzfassung, punkte } = await import("./messung.mjs");
  const jetzt = new Date("2026-10-23T12:00:00Z");
  const post = (id, mechanik, schluss, stunden) => ({ id, gepostetAm: new Date(jetzt - stunden * 3600e3), e: { inhalt: { format: "szene", satz: "Mama fragt nach jemandem.", klammern: [schluss] }, mechanik, zielgruppe: "dating" } });
  const ps = [post("a", "absage", "Herbert. Fledermaus.", 30), post("b", "absage", "Zum Müll.", 50), post("c", "kontrast", "Stromrechnung.", 60), post("d", "kontrast", "Ich nicht.", 70), post("e", "absage", "Kalender.", 3)];
  const ig = { status: "ok", werte: { a: { reach: 300, shares: 5, saved: 0 }, b: { reach: 200 }, c: { reach: 50 }, d: { reach: 40 }, e: { reach: 999 } } };
  const yt = { status: "uebersprungen" };
  assert.equal(punkte(ig.werte.a, {}), 350);
  const k = kurzfassung({ posts: ps, ig, yt, jetzt });
  assert.equal(k.signal.bewertet, 4); // e ist jünger als 24 h
  assert.equal(k.signal.top[0].id, "a");
  assert.deepEqual(k.signal.mehr.mechanik, ["absage"]);
  assert.deepEqual(k.signal.weniger.mechanik, ["kontrast"]);
  assert.ok(k.signal.fehler.some((f) => f.id === "d" && /kein neues konkretes Wort/.test(f.fehler[0])));
  assert.match(k.text, /Top 3[\s\S]*Herbert\. Fledermaus\./);
});

test("Datenbank: Merkmale und Zahlen pro Post, alte Werte bleiben, Facebook über gespeicherte ID", async () => {
  const { datenbank, merkmale, facebook } = await import("./messung.mjs");
  const e = { inhalt: { format: "szene", satz: "Lena: „Was ist dein größter Ick?“", klammern: ["Wenn er Fragen stellt.", "„Welche denn?“", "Wie es mir geht."] },
    caption: "Ich bin pflegeleicht.", aufforderung: "Schick das der Freundin.", hashtags: ["#a", "#b"], mechanik: "gestaendnis", zielgruppe: "dating", trend: "TikTok: The Ick", bild: "x.jpg" };
  const p = { id: "2026-10-23-11", e, gepostetAm: new Date("2026-10-23T09:20:00Z"), art: "Schick das", plattformen: { facebook: "1_2" } };
  const m = merkmale(p);
  assert.equal(m.wochentag, "Fr");
  assert.equal(m.slot, "11");
  assert.equal(m.gegenueber, "Lena");
  assert.equal(m.schluss, "Wie es mir geht.");
  assert.equal(m.schluss_woerter, 4);
  assert.equal(m.trend, "TikTok: The Ick");
  const fakeFb = async (url) => ({ json: async () => (url.includes("fields=access_token") ? { access_token: "s" } : url.includes("/insights") ? { data: [{ values: [{ value: 90 }] }] } : { shares: { count: 3 }, reactions: { summary: { total_count: 7 } }, comments: { summary: { total_count: 1 } } }) });
  const fb = await facebook({ token: "t", seite: "1", posts: [p], f: fakeFb });
  assert.deepEqual({ s: fb.werte[p.id].shares, r: fb.werte[p.id].reichweite }, { s: 3, r: 90 });
  const jetzt = new Date("2026-10-25T09:20:00Z");
  const db1 = datenbank(null, { posts: [p], ig: { status: "ok", werte: { [p.id]: { reach: 200, shares: 4, saved: 2 } } }, yt: { status: "uebersprungen" }, fb, jetzt });
  const d = db1.posts[p.id];
  assert.equal(d.alter_h, 48);
  assert.equal(d.ig.share_quote, 0.02);
  assert.equal(d.facebook.shares, 3);
  assert.equal(d.punkte, 260);
  // Nächste Messung ohne Instagram: die alten IG-Werte bleiben stehen
  const db2 = datenbank(db1, { posts: [p], ig: { status: "uebersprungen" }, yt: { status: "uebersprungen" }, jetzt });
  assert.equal(db2.posts[p.id].ig.reichweite, 200);
});

test("Teilquote: Shares und Saves je 1.000 erreichte Konten", async () => {
  const { teilquote } = await import("./messung.mjs");
  assert.equal(teilquote({ reach: 400, shares: 3, saved: 1 }), 10);
  assert.equal(teilquote({}), null);
});
