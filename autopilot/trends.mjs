// Sammelt einmal pro Woche, was in Österreich gerade Thema ist, als Markdown für den wöchentlichen Schreib-Lauf.
// Quellen ohne Login: Google Trends (AT, DE), meistgelesene Wikipedia-Artikel (de, letzte 7 Tage), Reddit (Alltag, Schule, Job, Uni),
// Schulferien Österreich und Deutschland (OpenHolidays), kuriose Gedenktage,
// YouTube-Trends AT (nur mit den vorhandenen YouTube-Secrets), Kommentare unter den eigenen Instagram-Posts, Anlässe der nächsten 21 Tage und harmlose ORF-Schlagzeilen.
// Der Wortfilter aus anlaesse.mjs wirft Politik, Unglücke und Kriminalität vorab raus. Personen, Marken und Sport
// filtert er nicht: Die Trends sind nur Anregung für ein Thema aus Resis Alltag, nie Vorlage (siehe autopilot/nachschub.md).
// Jede Quelle darf scheitern, dann steht „nicht erreichbar“ da. Aufruf: node trends.mjs [JJJJ-MM-TT] [--schnell]
// --schnell: täglicher Kurzlauf für den Trend-Schnellweg (nur, was gerade jetzt läuft: Google Trends, Wikipedia gestern,
// Reddit Top des Tages, YouTube-Trends, ORF, Anlässe der nächsten 3 Tage), dauert etwa 2 Minuten.
import { feste, harmlos, schlagzeilen } from "./anlaesse.mjs";

const direkt = import.meta.url === `file://${process.argv[1]}`;
const schnell = direkt && process.argv.includes("--schnell");
const datum = (direkt && process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))) || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
const UA = { "user-agent": "oida-leberkas-trends/1.0 (https://oidaleberkas.at)" };
const MAX = 15;

const entities = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const holen = async (url, opt = {}) => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10000), ...opt });
  if (!res.ok) throw new Error(`${res.status}`);
  return res;
};
const tag = (xml, name) => [...xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "g"))].map((m) => entities(m[1]));

export function googleLesen(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const titel = tag(item, "title")[0];
    const menge = tag(item, "ht:approx_traffic")[0];
    const news = tag(item, "ht:news_item_title")[0];
    return `${titel}${menge ? ` (${menge} Suchen)` : ""}${news ? `: ${news}` : ""}`;
  });
}

const googleTrends = async (geo = "AT") => googleLesen(await (await holen(`https://trends.google.com/trending/rss?geo=${geo}`)).text());

async function wikipedia(datum, tage = 7) {
  // Die Tages-Toplisten der letzten Tage zusammenzählen
  const summe = new Map();
  for (let i = 1; i <= tage; i++) {
    const d = new Date(Date.parse(datum + "T12:00:00Z") - i * 864e5).toISOString().slice(0, 10).split("-");
    try {
      const j = await (await holen(`https://wikimedia.org/api/rest_v1/metrics/pageviews/top/de.wikipedia/all-access/${d[0]}/${d[1]}/${d[2]}`)).json();
      for (const a of j.items[0].articles) summe.set(a.article, (summe.get(a.article) || 0) + a.views);
    } catch { /* fehlender Tag zählt nicht */ }
  }
  if (!summe.size) throw new Error("keine Daten");
  return [...summe].filter(([a]) => !/^(Spezial|Wikipedia|Datei|Portal|Hilfe|Benutzer|Kategorie):|^Hauptseite$/.test(a))
    .sort((a, b) => b[1] - a[1]).map(([a, v]) => `${a.replace(/_/g, " ")} (${Math.round(v / 1000)}k Aufrufe)`);
}

// Atom-Feed: Titel der Einträge, nicht der des Feeds
export const redditLesen = (xml) => [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => tag(e, "title")[0]).filter(Boolean);
// Reddit drosselt Abrufe ohne Login (429): langsam nacheinander, bei 429 einmal nach einer Minute nochmal
const reddit = async (sub, zeit = "week") => {
  const url = `https://www.reddit.com/r/${sub}/top/.rss?t=${zeit}&limit=25`;
  await pause(15000);
  const text = await holen(url).catch(async (err) => {
    if (err.message !== "429") throw err;
    await pause(60000);
    return holen(url);
  });
  return redditLesen(await text.text());
};

// Schulferien der nächsten 60 Tage in AT und DE (OpenHolidays API, frei, ohne Schlüssel). Gleiche Ferien mehrerer Bundesländer
// werden zu einer Zeile zusammengefasst, sortiert nach Beginn. Publikum (YouTube, 19.10.2026): Deutschland 37 %, Österreich 25 %.
export const ferienLesen = (liste) => {
  const zeilen = new Map();
  for (const f of [...liste].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const kopf = `${f.startDate} bis ${f.endDate}: ${(f.name.find((n) => n.language === "DE") || f.name[0]).text}`;
    const laender = (f.subdivisions || []).map((s) => s.shortName || s.code);
    zeilen.set(kopf, [...(zeilen.get(kopf) || []), ...laender]);
  }
  return [...zeilen].map(([kopf, laender]) => (laender.length ? `${kopf} (${[...new Set(laender)].join(", ")})` : kopf));
};
async function schulferien(datum) {
  const bis = new Date(Date.parse(datum + "T12:00:00Z") + 60 * 864e5).toISOString().slice(0, 10);
  const land = async (code) => (await (await holen(`https://openholidaysapi.org/SchoolHolidays?countryIsoCode=${code}&languageIsoCode=DE&validFrom=${datum}&validTo=${bis}`, { headers: { ...UA, accept: "application/json" } })).json());
  return ferienLesen([...(await land("DE")), ...(await land("AT"))]);
}

// Kuriose Gedenk- und Aktionstage (Tag der Jogginghose, Weltknuddeltag …), WordPress-Feed
const kurioseTage = async () => tag(await (await holen("https://www.kuriose-feiertage.de/feed/")).text(), "title").filter((t) => !t.includes("kuriose-feiertage"));

async function youtube(region = "AT", kategorie = "") {
  const { YOUTUBE_CLIENT_ID: id, YOUTUBE_CLIENT_SECRET: secret, YOUTUBE_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) throw new Error("keine YouTube-Secrets");
  const token = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }) })).json();
  if (!token.access_token) throw new Error(token.error || "kein Token");
  const j = await (await holen(`https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=${region}&maxResults=25${kategorie && `&videoCategoryId=${kategorie}`}`, { headers: { ...UA, authorization: `Bearer ${token.access_token}` } })).json();
  return j.items.map((v) => `${v.snippet.title} (${v.snippet.channelTitle})`);
}

// Kommentare unter den eigenen Instagram-Posts: Fragen und Sprüche des Publikums als Stoff für Antwort-Karten.
// Braucht das Recht instagram_manage_comments; fehlt es, steht „nicht erreichbar“ da. Namen werden nie übernommen.
async function kommentare() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("kein Instagram-Token");
  const ig = process.env.IG_USER_ID || "17841454284048783";
  const j = await (await fetch(`https://graph.facebook.com/${ig}/media?${new URLSearchParams({ fields: "caption,comments.limit(20){text}", limit: "20", access_token: token })}`, { signal: AbortSignal.timeout(10000) })).json();
  if (j.error) throw new Error(j.error.message);
  return j.data.flatMap((m) => (m.comments?.data || []).map((c) => `${c.text.replace(/\s+/g, " ").replace(/@\S+/g, "@…").slice(0, 160)} (unter „${(m.caption || "").split("\n")[0].slice(0, 40)}“)`));
}

// Fanbase-Quellen (Gesamt-Check 22.10.2026): Die Fanbase sind junge Frauen 18 bis 28 in DE und AT. Was unter ihren Hashtags und in
// Dating-Shorts gerade läuft, zeigt Formate und Gefühle, die sie kennen. Nur Thema und Format übernehmen, nie Text, Person oder Sound.
export const FANBASE_HASHTAGS = ["situationship", "ihatemybf", "singleleben", "datingapp", "beziehungsmemes", "freundinnen", "introvert", "gothgirl"];
async function igHashtags(tags = FANBASE_HASHTAGS) {
  // Hashtag-Suche der Graph-API (instagram_basic, höchstens 30 verschiedene Hashtags pro 7 Tage; 8 pro Woche bleiben weit darunter)
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error("kein Instagram-Token");
  const ig = process.env.IG_USER_ID || "17841454284048783";
  const api = async (pfad, q) => {
    const j = await (await fetch(`https://graph.facebook.com/${pfad}?${new URLSearchParams({ ...q, access_token: token })}`, { signal: AbortSignal.timeout(30000) })).json();
    if (j.error) throw new Error(j.error.message);
    return j;
  };
  // Die Hashtag-Suche ist langsam (Lauf 22.10.: Abbruch nach 10 s); jeder Hashtag darf einzeln scheitern
  const aus = [], fehler = [];
  for (const t of tags) {
    let top;
    try {
      const id = (await api("ig_hashtag_search", { user_id: ig, q: t })).data?.[0]?.id;
      if (!id) continue;
      top = (await api(`${id}/top_media`, { user_id: ig, fields: "caption,like_count,comments_count", limit: "10" })).data || [];
    } catch (err) { fehler.push(`#${t}: ${err.message}`); continue; }
    for (const m of top.filter((x) => x.caption).sort((a, b) => (b.like_count || 0) - (a.like_count || 0)).slice(0, 3)) {
      aus.push(`#${t}: „${m.caption.split("\n")[0].replace(/@\S+/g, "@…").replace(/#\S+/g, "").trim().slice(0, 110)}“ (${m.like_count ?? "?"} Likes, ${m.comments_count ?? "?"} Kommentare)`);
    }
  }
  if (!aus.length && fehler.length) throw new Error(fehler[0]);
  return aus;
}
// Dating- und Beziehungs-Shorts der letzten 7 Tage in Deutschland, nach Views (YouTube-Suche, 100 Einheiten vom Tageskontingent)
// Nur deutschsprachige Titel: relevanceLanguage filtert nicht hart (Lauf 22.10.: zwei Drittel englisch oder indisch)
export const deutsch = (t) => /[äöüß]|\b(ich|du|mein|meine|wenn|nicht|und|der|die|das|mit|wer|freund|freundin|beziehung|ex)\b/i.test(t);
async function youtubeShorts(datum, q = "beziehung|freundin|freund|situationship|ex|date deutsch") {
  const { YOUTUBE_CLIENT_ID: id, YOUTUBE_CLIENT_SECRET: secret, YOUTUBE_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) throw new Error("keine YouTube-Secrets");
  const token = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }) })).json();
  if (!token.access_token) throw new Error(token.error || "kein Token");
  const seit = new Date(Date.parse(datum + "T00:00:00Z") - 7 * 864e5).toISOString();
  const s = new URLSearchParams({ part: "snippet", type: "video", videoDuration: "short", regionCode: "DE", relevanceLanguage: "de", order: "viewCount", publishedAfter: seit, q, maxResults: "50" });
  const j = await (await holen(`https://www.googleapis.com/youtube/v3/search?${s}`, { headers: { ...UA, authorization: `Bearer ${token.access_token}` } })).json();
  return (j.items || []).map((v) => entities(v.snippet.title)).filter(deutsch);
}

export function anlaesse(datum, tage = 21) {
  const liste = [];
  for (let i = 0; i < tage; i++) {
    const d = new Date(Date.parse(datum + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10);
    // Dauer-Hinweise (Christkindlmärkte, Ballsaison) nur am ersten Tag, sonst steht jeder Tag voll
    // „(in 2 Tagen)“-Vorwarnungen fallen weg, der Tag selbst steht ja da
    const f = feste(d).filter((a) => !/\(in \d/.test(a) && (i === 0 || !/haben offen|Ballsaison|Schulbeginn|Hochsommer/.test(a)));
    if (f.length) liste.push(`${d}: ${f.join("; ")}`);
  }
  return liste;
}

// Subreddits mit Alltag, Schule, Studium, Job und Beziehungen; was dort hochgewählt wird, kennt das Publikum aus dem eigenen Leben
const REDDIT = [
  ["wien", "Wien"], ["Austria", "Österreich"], ["de", "Deutschland"], ["FragReddit", "Alltagsfragen"],
  ["arbeitsleben", "Job"], ["Studium", "Uni"], ["teenagers", "Teenager, englisch"], ["Showerthoughts", "Alltagsgedanken, englisch"],
  // Fanbase (seit 22.10.2026): Beziehungsfragen und Alltag junger Frauen, deutschsprachig
  ["beziehungen", "Beziehungen, Fanbase"], ["Weibsvolk", "junge Frauen, Fanbase"],
];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

// Schnellweg: nur deutschsprachige Subreddits mit viel Alltag, Top des Tages
const REDDIT_SCHNELL = [["de", "Deutschland"], ["Austria", "Österreich"], ["wien", "Wien"], ["FragReddit", "Alltagsfragen"]];

export function schnellQuellen(datum) {
  return [
    ["Google Trends Deutschland (gerade jetzt)", () => googleTrends("DE")],
    ["Google Trends Österreich (gerade jetzt)", () => googleTrends("AT")],
    ["Wikipedia de, meistgelesen gestern", () => wikipedia(datum, 1)],
    ...REDDIT_SCHNELL.map(([sub, was]) => [`Reddit r/${sub}, Top des Tages (${was})`, () => reddit(sub, "day")]),
    ["YouTube-Trends Deutschland", () => youtube("DE")],
    ["YouTube-Trends Österreich", () => youtube()],
    ["ORF-Schlagzeilen (Wien, Science, Ö3, FM4)", schlagzeilen],
  ];
}

export async function trends(datum, { schnell = false } = {}) {
const quellen = schnell ? schnellQuellen(datum) : [
  // Fanbase zuerst: Was junge Frauen gerade teilen, wiegt mehr als allgemeine Suchtrends (nachschub.md, Gewichtung)
  ["Fanbase: Top-Posts unter Instagram-Hashtags (Format und Gefühl, nie Text)", () => igHashtags()],
  ["Fanbase: Dating-Shorts Deutschland, meistgesehen der Woche", () => youtubeShorts(datum)],
  ["Google Trends Deutschland (Suchanfragen der letzten Tage)", () => googleTrends("DE")],
  ["Google Trends Österreich", () => googleTrends("AT")],
  ["Wikipedia de, meistgelesen (letzte 7 Tage)", () => wikipedia(datum)],
  ...REDDIT.map(([sub, was]) => [`Reddit r/${sub}, Top der Woche (${was})`, () => reddit(sub)]),
  ["Schulferien Deutschland und Österreich (nächste 60 Tage)", () => schulferien(datum)],
  ["Kuriose Gedenk- und Aktionstage", kurioseTage],
  ["YouTube-Trends Deutschland", () => youtube("DE")],
  ["YouTube-Trends Österreich", () => youtube()],
  ["YouTube-Comedy Deutschland", () => youtube("DE", "23")],
  ["ORF-Schlagzeilen (Wien, Science, Ö3, FM4)", schlagzeilen],
  ["Kommentare unter unseren Instagram-Posts", kommentare],
];

const uhr = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" }).format(new Date());
const teile = schnell
  ? [`## Schnell-Trends ${datum} ${uhr}`, "", "Für den Trend-Schnellweg (autopilot/schnellweg.md): höchstens ein Post pro Tag, nur harmlose Themen, die viele gerade kennen.", ""]
  : [`## Trends ${datum}`, "", "Nur Anregung: Thema in Resis Alltag übersetzen, nie Personen, Marken, Politik, Unglücke oder fremde Memes übernehmen (autopilot/nachschub.md).", ""];
const tage = schnell ? 3 : 21;
teile.push(`**Anlässe der nächsten ${tage} Tage:**`, ...anlaesse(datum, tage).map((a) => `- ${a}`), "");
for (const [name, fn] of quellen) {
  let zeilen;
  try {
    const alle = await fn();
    const gefiltert = alle.filter(harmlos);
    zeilen = gefiltert.slice(0, MAX).map((z) => `- ${z}`);
    if (!zeilen.length) zeilen = ["- nichts Harmloses dabei"];
    zeilen.push(`- _(${alle.length} gefunden, ${alle.length - gefiltert.length} vom Filter entfernt)_`);
  } catch (err) {
    zeilen = [`- nicht erreichbar (${err.message})`];
  }
  teile.push(`**${name}:**`, ...zeilen, "");
}
return teile.join("\n");
}

if (direkt) console.log(await trends(datum, { schnell }));
