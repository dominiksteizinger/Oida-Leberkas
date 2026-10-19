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
