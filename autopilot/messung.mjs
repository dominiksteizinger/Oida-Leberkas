// Wöchentliche Auswertung: Instagram-Insights (Reichweite, Shares, Saves, Views) und YouTube Analytics (Views, durchschnittliche Wiedergabe).
// Fehlen Token oder Rechte, überspringt der jeweilige Teil sauber und sagt im Bericht, was fehlt (Anleitung: autopilot/messung-anleitung.md).
// Aufruf: node messung.mjs [Tage=28]  → schreibt auswertung/<datum>.md und gibt den Pfad aus (GITHUB_OUTPUT: datei=…)
import fs from "node:fs";
import path from "node:path";
import { captionText, titel as titelVon } from "./eintrag.mjs";
import { setupUndSchluss, pruefeSchluss } from "./schluss.mjs";
import { bildMass, pruefeAusschnitt } from "./ausschnitt.mjs";

const GRAPH = "https://graph.facebook.com";
const IG_METRIKEN = ["views", "reach", "saved", "shares", "likes", "comments", "ig_reels_avg_watch_time"];
const RECHTE_FEHLER = new Set([10, 190, 200, 283, 3]); // Meta: Berechtigung fehlt, Token ungültig, Zugriff verweigert
const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

// ---- Posts aus dem Tagebuch ----
export function postsLesen(wurzel, tage, jetzt = new Date()) {
  const dir = path.join(wurzel, "tagebuch");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}-\d{2}$/.test(d))
    .filter((d) => fs.existsSync(path.join(dir, d, "gepostet.txt")) && fs.existsSync(path.join(dir, d, "eintrag.json")))
    .map((d) => {
      const e = JSON.parse(fs.readFileSync(path.join(dir, d, "eintrag.json"), "utf8"));
      const gepostetAm = new Date(fs.readFileSync(path.join(dir, d, "gepostet.txt"), "utf8").trim());
      return { id: d, e, gepostetAm, art: aufforderungsArt(e.aufforderung) };
    })
    .filter((p) => !isNaN(p.gepostetAm) && (jetzt - p.gepostetAm) / 86400e3 <= tage)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export const aufforderungsArt = (a) => (/^schick das/i.test(a || "") ? "Schick das" : /\?$/.test(a || "") ? "Frage" : /speicher/i.test(a || "") ? "Speichern" : a ? "andere" : "ohne");

// ---- Instagram ----
async function graph(f, pfad, params, token) {
  const res = await f(`${GRAPH}/${pfad}?${new URLSearchParams({ ...params, access_token: token })}`);
  const j = await res.json();
  if (j.error) { const err = new Error(j.error.message); err.code = j.error.code; throw err; }
  return j;
}

export async function instagram({ token, igId, posts, f = fetch }) {
  if (!token) return { status: "uebersprungen", grund: "Secret INSTAGRAM_ACCESS_TOKEN fehlt" };
  let medien;
  try {
    medien = (await graph(f, `${igId}/media`, { fields: "id,caption,timestamp,permalink,media_product_type", limit: "50" }, token)).data || [];
  } catch (err) {
    return { status: "uebersprungen", grund: `Medienliste nicht lesbar: ${err.message}` };
  }
  const nachCaption = new Map(medien.map((m) => [norm(m.caption), m]));
  const werte = {};
  let rechteGrund = null;
  for (const p of posts) {
    const m = nachCaption.get(norm(captionText(p.e)));
    if (!m) { werte[p.id] = { fehlt: "kein passendes Instagram-Medium gefunden" }; continue; }
    const v = { link: m.permalink };
    try {
      Object.assign(v, await metriken(f, m.id, token));
    } catch (err) {
      if (RECHTE_FEHLER.has(err.code)) { rechteGrund = `${err.message} (Code ${err.code}). Wahrscheinlich fehlt die Berechtigung instagram_manage_insights im Token`; break; }
      v.fehlt = err.message;
    }
    werte[p.id] = v;
  }
  if (rechteGrund) return { status: "uebersprungen", grund: rechteGrund };
  return { status: "ok", werte };
}

// Alle Metriken in einem Aufruf; lehnt Meta eine ab (Metrik für diesen Medientyp/diese API-Version nicht vorhanden), einzeln nachholen
async function metriken(f, id, token) {
  const aus = {};
  const lesen = (j) => { for (const d of j.data || []) aus[d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? null; };
  try {
    lesen(await graph(f, `${id}/insights`, { metric: IG_METRIKEN.join(",") }, token));
  } catch (err) {
    if (err.code !== 100) throw err;
    for (const m of IG_METRIKEN) {
      try { lesen(await graph(f, `${id}/insights`, { metric: m }, token)); } catch (e2) { if (e2.code !== 100) throw e2; }
    }
  }
  return aus;
}

// ---- YouTube ----
export async function youtube({ env, posts, von, bis, f = fetch }) {
  const { YOUTUBE_CLIENT_ID: id, YOUTUBE_CLIENT_SECRET: secret, YOUTUBE_REFRESH_TOKEN: refresh } = env;
  if (!id || !secret || !refresh) return { status: "uebersprungen", grund: "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET oder YOUTUBE_REFRESH_TOKEN fehlt" };
  const t = await (await f("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }) })).json();
  if (!t.access_token) return { status: "uebersprungen", grund: `Anmeldung fehlgeschlagen: ${t.error_description || t.error}. Refresh-Token neu erzeugen` };
  const scope = String(t.scope || "");
  if (!scope.includes("yt-analytics.readonly")) return { status: "uebersprungen", grund: "Der Refresh-Token hat den Bereich yt-analytics.readonly nicht. Neu erzeugen (Anleitung Teil B)" };
  const kopf = { Authorization: `Bearer ${t.access_token}` };
  const q = new URLSearchParams({ ids: "channel==MINE", startDate: von, endDate: bis, dimensions: "video", sort: "-views", maxResults: "200",
    metrics: "views,averageViewDuration,averageViewPercentage,likes,shares,comments,subscribersGained" });
  const res = await f(`https://youtubeanalytics.googleapis.com/v2/reports?${q}`, { headers: kopf });
  const j = await res.json();
  if (!res.ok) return { status: "uebersprungen", grund: `Analytics-Abfrage: ${j.error?.message || res.status}` };
  const spalten = (j.columnHeaders || []).map((c) => c.name);
  const zeilen = (j.rows || []).map((r) => Object.fromEntries(spalten.map((n, i) => [n, r[i]])));
  // Titel nur mit youtube.readonly; ohne ihn bleiben die Videos unzugeordnet und stehen mit Link im Bericht
  let titel = {};
  if (zeilen.length && scope.includes("youtube.readonly")) {
    for (let i = 0; i < zeilen.length; i += 50) {
      const ids = zeilen.slice(i, i + 50).map((z) => z.video).join(",");
      const v = await (await f(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}`, { headers: kopf })).json();
      for (const x of v.items || []) titel[x.id] = x.snippet.title;
    }
  }
  const werte = {};
  const rest = [];
  const nachTitel = new Map(posts.map((p) => [norm(youtubeTitel(p.e)), p]));
  for (const z of zeilen) {
    const p = titel[z.video] && nachTitel.get(norm(titel[z.video]));
    if (p) werte[p.id] = { ...z, link: `https://youtube.com/shorts/${z.video}` };
    else rest.push({ ...z, titel: titel[z.video], link: `https://youtube.com/shorts/${z.video}` });
  }
  // Analytics hinkt 1 bis 3 Tage hinterher. Für Posts ohne Analytics-Zeile die aktuellen Zähler aus der Data API (nur Views, Likes, Kommentare)
  let vorlaeufig = 0;
  if (scope.includes("youtube.readonly") && posts.some((p) => !werte[p.id])) {
    const kanal = await (await f("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true", { headers: kopf })).json();
    const liste = kanal.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (liste) {
      const items = (await (await f(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${liste}`, { headers: kopf })).json()).items || [];
      const ids = items.map((i) => i.contentDetails.videoId).join(",");
      const videos = ids ? (await (await f(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${ids}`, { headers: kopf })).json()).items || [] : [];
      for (const v of videos) {
        const p = nachTitel.get(norm(v.snippet.title));
        if (!p || werte[p.id]) continue;
        const st = v.statistics || {};
        werte[p.id] = { views: Number(st.viewCount ?? 0), likes: Number(st.likeCount ?? 0), comments: Number(st.commentCount ?? 0), link: `https://youtube.com/shorts/${v.id}`, vorlaeufig: true };
        vorlaeufig++;
      }
    }
  }
  return { status: "ok", werte, rest, vorlaeufig, ohneTitel: !scope.includes("youtube.readonly") };
}

// Gleicher Titel wie in youtube.mjs
export function youtubeTitel(e) {
  const kurz = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  return kurz(`${titelVon(e.inhalt)} #Shorts`.replace(/[<>]/g, ""), 100);
}

// ---- Bericht ----
const zahl = (x, nk = 0) => (x === undefined || x === null || Number.isNaN(x) ? "–" : Number(x).toLocaleString("de-AT", { maximumFractionDigits: nk }));
const sek = (ms) => (ms === undefined || ms === null ? "–" : `${zahl(ms / 1000, 1)} s`);
const mittel = (liste, f) => { const v = liste.map(f).filter((x) => typeof x === "number"); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

// ---- Kurzfassung (Dominik 22.10.2026: Auswertung schnell lesbar, Fehler nicht wiederholen) ----
// Eine Zahl pro Post: Punkte = IG-Reichweite + YT-Views + 10 × (IG-Shares + IG-Saves). Shares und Saves zählen zehnfach,
// weil ein geteilter Post den Send-Test bestanden hat. Bewertet werden nur Posts der letzten 7 Tage, die älter als 24 h sind.
export const KURZ = { tage: 7, mindestAlterStunden: 24, gewichtTeilen: 10, mehr: 120, weniger: 80, mindestPosts: 2 };

export function punkte(i = {}, y = {}) {
  const n = (x) => (typeof x === "number" ? x : 0);
  if (i.reach === undefined && y.views === undefined) return null;
  return n(i.reach) + n(y.views) + KURZ.gewichtTeilen * (n(i.shares) + n(i.saved));
}

// Fehler-Check auf das, was wirklich rausging: dieselben Prüfungen wie pruefen.mjs (Schluss, Kopf im Bild) plus fehlende Pflichtfelder
export function fehlerCheck(p, bibliothek = [], bilderDir = null) {
  const f = [...pruefeSchluss(p.e)];
  if (!p.e.mechanik) f.push("ohne mechanik");
  if (!p.e.zielgruppe) f.push("ohne zielgruppe");
  if (p.e.bild) {
    const b = bibliothek.find((x) => x.datei === p.e.bild);
    let mass = null;
    try { if (bilderDir) mass = bildMass(path.join(bilderDir, p.e.bild)); } catch {}
    f.push(...pruefeAusschnitt(p.e, b, mass));
  }
  return f.map((x) => x.replace(/ \(bewusst so:.*\)$/, ""));
}

export function kurzfassung({ posts, ig, yt, jetzt = new Date(), bibliothek = [], bilderDir = null }) {
  const igw = (id) => (ig.status === "ok" ? ig.werte[id] || {} : {});
  const ytw = (id) => (yt.status === "ok" ? yt.werte[id] || {} : {});
  const alter = (p) => (jetzt - p.gepostetAm) / 3600e3;
  const woche = posts.filter((p) => alter(p) <= KURZ.tage * 24);
  const reif = woche.filter((p) => alter(p) >= KURZ.mindestAlterStunden)
    .map((p) => ({ p, wert: punkte(igw(p.id), ytw(p.id)), schluss: setupUndSchluss(p.e.inhalt)?.schluss || titelVon(p.e.inhalt) }))
    .filter((x) => x.wert !== null)
    .sort((a, b) => b.wert - a.wert);
  const schnitt = reif.length ? reif.reduce((a, x) => a + x.wert, 0) / reif.length : 0;
  const index = (l) => (schnitt ? Math.round((l.reduce((a, x) => a + x.wert, 0) / l.length / schnitt) * 100) : 0);
  const gruppen = (fn) => {
    const m = new Map();
    for (const x of reif) { const k = fn(x.p.e) || "ohne Tag"; (m.get(k) || m.set(k, []).get(k)).push(x); }
    return [...m].map(([k, l]) => ({ k, n: l.length, index: index(l) })).sort((a, b) => b.index - a.index);
  };
  const mech = gruppen((e) => e.mechanik), zg = gruppen((e) => e.zielgruppe), trend = gruppen((e) => (e.trend ? "Trend-Post" : "ohne Trend"));
  const zaehlt = (g) => g.k !== "ohne Tag" && g.n >= KURZ.mindestPosts;
  const auswahl = (l, f) => l.filter((g) => zaehlt(g) && f(g.index)).map((g) => g.k);
  const signal = {
    mehr: { mechanik: auswahl(mech, (i) => i >= KURZ.mehr), zielgruppe: auswahl(zg, (i) => i >= KURZ.mehr) },
    weniger: { mechanik: auswahl(mech, (i) => i <= KURZ.weniger), zielgruppe: auswahl(zg, (i) => i <= KURZ.weniger) },
  };
  const knapp = (x) => ({ id: x.p.id, titel: titelVon(x.p.e.inhalt), schluss: x.schluss, format: x.p.e.inhalt.format, mechanik: x.p.e.mechanik || null, zielgruppe: x.p.e.zielgruppe || null, trend: x.p.e.trend || null, punkte: x.wert });
  const top = reif.slice(0, 3).map(knapp);
  const flop = reif.length > 3 ? reif.slice(-Math.min(3, reif.length - 3)).reverse().map(knapp) : [];
  const fehler = woche.map((p) => ({ id: p.id, schluss: setupUndSchluss(p.e.inhalt)?.schluss || "", f: fehlerCheck(p, bibliothek, bilderDir) })).filter((x) => x.f.length);

  const z = ["## Kurzfassung der Woche", ""];
  if (!reif.length) z.push(`Noch keine Zahlen: ${woche.length} Posts in den letzten ${KURZ.tage} Tagen, keiner älter als ${KURZ.mindestAlterStunden} h mit Werten von Instagram oder YouTube.`, "");
  else {
    z.push(`${woche.length} Posts in ${KURZ.tage} Tagen, ${reif.length} bewertet. Punkte = IG-Reichweite + YT-Views + ${KURZ.gewichtTeilen} × (Shares + Saves). Schnitt: **${zahl(schnitt)} Punkte**, Index 100 = Schnitt.`, "");
    const zeile = (x) => `| ${x.punkte} | „${x.schluss}“ | ${x.format} | ${x.mechanik || "–"} | ${x.zielgruppe || "–"}${x.trend ? " · Trend" : ""} |`;
    const kopf = ["| Punkte | Schluss | Format | Mechanik | Zielgruppe |", "|---|---|---|---|---|"];
    z.push("**Top 3**", "", ...kopf, ...top.map(zeile), "");
    if (flop.length) z.push("**Flop 3**", "", ...kopf, ...flop.map(zeile), "");
    const pfeil = (g) => (!zaehlt(g) ? "" : g.index >= KURZ.mehr ? " ▲" : g.index <= KURZ.weniger ? " ▼" : "");
    const liste = (l) => l.map((g) => `${g.k} ${g.index}${pfeil(g)} (${g.n})`).join(" · ");
    z.push(`**Mechanik:** ${liste(mech)}`, "", `**Zielgruppe:** ${liste(zg)}`, "", `**Trend:** ${liste(trend)}`, "");
    z.push(`▲ ab Index ${KURZ.mehr}, ▼ bis ${KURZ.weniger}, erst ab ${KURZ.mindestPosts} Posts. In Klammern die Anzahl. Bei so wenigen Posts ist das Tendenz, kein Beweis.`, "");
  }
  const was = (o) => [o.mechanik.length && `Mechanik ${o.mechanik.join(", ")}`, o.zielgruppe.length && `Zielgruppe ${o.zielgruppe.join(", ")}`].filter(Boolean).join("; ");
  z.push("**Für den Nachschub** (steht auch in `auswertung/signal.json`, der Schreib-Lauf liest es):", "",
    `- Mehr davon: ${was(signal.mehr) || "noch kein klares Signal"}`, `- Weniger davon: ${was(signal.weniger) || "noch kein klares Signal"}`, "");
  z.push("**Fehler-Check** (gleiche Prüfung wie vor dem Anlegen: Schluss, Kopf im Bild, Pflichtfelder):", "");
  if (!fehler.length) z.push("- Keine bekannten Fehler in den Posts der Woche.", "");
  else z.push(...fehler.map((x) => `- ${x.id} „${x.schluss}“: ${x.f.join("; ")}`), "");
  return { text: z.join("\n"), signal: { ...signal, top, flop, schnitt: Math.round(schnitt), bewertet: reif.length, fehler: fehler.map((x) => ({ id: x.id, fehler: x.f })) } };
}

export function bericht({ datum, tage, posts, ig, yt, kurz = null }) {
  const z = [`# Wochenauswertung ${datum}`, ""];
  if (kurz) z.push(kurz, `<details><summary>Details: alle Posts und Gruppen der letzten ${tage} Tage</summary>`, "");
  z.push(`Posts der letzten ${tage} Tage: ${posts.length}. Werte sind Gesamtstände zum Abrufzeitpunkt, junge Posts (unter 24 h) sind noch nicht aussagekräftig.`, "");
  z.push("## Status der Abfragen", "");
  for (const [name, r] of [["Instagram", ig], ["YouTube", yt]]) z.push(r.status === "ok" ? `- ${name}: ok${r.vorlaeufig ? ` (${r.vorlaeufig} Posts nur mit aktuellen Zählern, Analytics kommt mit 1 bis 3 Tagen Verzug; Ø-Wiedergabe fehlt dort noch)` : ""}` : `- ${name}: **übersprungen**: ${r.grund}. Anleitung: autopilot/messung-anleitung.md`);
  z.push("");
  const igw = (id) => (ig.status === "ok" ? ig.werte[id] || {} : {});
  const ytw = (id) => (yt.status === "ok" ? yt.werte[id] || {} : {});
  if (ig.status === "ok" || yt.status === "ok") {
    z.push("## Pro Post", "", "| Post | Format | Aufforderung | IG Views | IG Reichweite | IG Shares | IG Saves | IG Ø Wiedergabe | YT Views | YT Ø Wiedergabe |", "|---|---|---|---|---|---|---|---|---|---|");
    for (const p of posts) {
      const i = igw(p.id), y = ytw(p.id);
      z.push(`| ${p.id}${i.link ? ` ([IG](${i.link}))` : ""}${y.link ? ` ([YT](${y.link}))` : ""} | ${p.e.inhalt.format} | ${p.art} | ${zahl(i.views)} | ${zahl(i.reach)} | ${zahl(i.shares)} | ${zahl(i.saved)} | ${sek(i.ig_reels_avg_watch_time)} | ${zahl(y.views)} | ${y.averageViewDuration === undefined ? "–" : `${zahl(y.averageViewDuration, 1)} s (${zahl(y.averageViewPercentage)} %)`} |`);
    }
    z.push("");
    const gruppen = (titelText, schluessel) => {
      const m = new Map();
      for (const p of posts) { const k = schluessel(p); (m.get(k) || m.set(k, []).get(k)).push(p); }
      z.push(`## ${titelText}`, "", "| Gruppe | Posts | Ø IG Reichweite | Ø IG Shares | Ø IG Saves | Ø YT Views |", "|---|---|---|---|---|---|");
      for (const [k, l] of [...m].sort((a, b) => b[1].length - a[1].length))
        z.push(`| ${k} | ${l.length} | ${zahl(mittel(l, (p) => igw(p.id).reach))} | ${zahl(mittel(l, (p) => igw(p.id).shares), 1)} | ${zahl(mittel(l, (p) => igw(p.id).saved), 1)} | ${zahl(mittel(l, (p) => ytw(p.id).views))} |`);
      z.push("");
    };
    gruppen("Nach Format", (p) => p.e.inhalt.format);
    gruppen("Nach Aufforderung", (p) => p.art);
    gruppen("Nach Slot", (p) => `${p.e.slot} Uhr`);
    gruppen("Nach Mechanik", (p) => p.e.mechanik || "ohne Tag");
    gruppen("Nach Zielgruppe", (p) => p.e.zielgruppe || "ohne Tag");
    gruppen("Nach Region", (p) => p.e.region || "dach");
    if (ig.status === "ok") {
      const rang = posts.map((p) => ({ p, r: igw(p.id).reach, s: igw(p.id).shares })).filter((x) => x.r > 0 && typeof x.s === "number").sort((a, b) => b.s / b.r - a.s / a.r);
      if (rang.length) {
        z.push("## Shares pro Reichweite (Instagram)", "", "Sends/Shares gelten als wichtigstes Signal für Nichtfolger (Plattform-Gewichte nicht belegt). Beste und schwächste drei:", "");
        for (const x of [...rang.slice(0, 3), ...(rang.length > 6 ? rang.slice(-3) : [])]) z.push(`- ${x.p.id} (${x.p.e.inhalt.format}): ${zahl((x.s / x.r) * 100, 1)} % (${x.s} Shares bei ${x.r} Reichweite)`);
        z.push("");
      }
    }
  }
  if (yt.status === "ok" && yt.rest.length) {
    z.push("## YouTube-Videos ohne Zuordnung", "", yt.ohneTitel ? "Der Token hat youtube.readonly nicht, deshalb fehlen Titel und Zuordnung zu den Posts." : "Titel passt zu keinem Post der Auswertung (älter als der Zeitraum oder von Hand hochgeladen).", "");
    for (const r of yt.rest.slice(0, 20)) z.push(`- ${r.link}${r.titel ? ` „${r.titel}“` : ""}: ${zahl(r.views)} Views, Ø ${zahl(r.averageViewDuration, 1)} s`);
    z.push("");
  }
  z.push("## Hinweise", "", "- Instagram-Reichweite zählt Konten, Views zählen Wiedergaben. Beide sind Gesamtstände seit dem Posten.", "- „Viewed vs. swiped away“ (Shorts) steht nur in YouTube Studio, nicht in der API.", "- Weniger als 20 Posts pro Gruppe sind Tendenz, kein Beweis.");
  if (kurz) z.push("", "</details>");
  return z.join("\n") + "\n";
}

// ---- Skript ----
async function main() {
  const wurzel = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
  const tage = Number(process.argv[2] || 28);
  const jetzt = new Date();
  const datum = jetzt.toISOString().slice(0, 10);
  const posts = postsLesen(wurzel, tage, jetzt);
  const von = new Date(jetzt - tage * 86400e3).toISOString().slice(0, 10);
  const sicher = async (fn, name) => { try { return await fn(); } catch (err) { return { status: "uebersprungen", grund: `${name} unerwartet gescheitert: ${err.message}` }; } };
  const ig = await sicher(() => instagram({ token: process.env.INSTAGRAM_ACCESS_TOKEN, igId: process.env.IG_USER_ID || "17841454284048783", posts }), "Instagram");
  const yt = await sicher(() => youtube({ env: process.env, posts, von, bis: datum }), "YouTube");
  const hier = path.join(wurzel, "autopilot");
  const bibliothek = JSON.parse(fs.readFileSync(path.join(hier, "bibliothek.json"), "utf8"));
  const kurz = kurzfassung({ posts, ig, yt, jetzt, bibliothek, bilderDir: path.join(hier, "bilder") });
  const text = bericht({ datum, tage, posts, ig, yt, kurz: kurz.text });
  const dir = path.join(wurzel, "auswertung");
  fs.mkdirSync(dir, { recursive: true });
  // Rückkopplung für den Schreib-Lauf (nachschub.md, schnellweg.md): was mehr, was weniger, Top und Flop mit Schluss
  fs.writeFileSync(path.join(dir, "signal.json"), JSON.stringify({ datum, ...kurz.signal }, null, 2) + "\n");
  const datei = path.join(dir, `${datum}.md`);
  fs.writeFileSync(datei, text);
  console.log(text);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `datei=auswertung/${datum}.md\nubersprungen=${[ig, yt].filter((r) => r.status !== "ok").length}\n`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) await main();
