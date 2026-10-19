// Sammelt einmal pro Woche, was in Österreich gerade Thema ist, als Markdown für den wöchentlichen Schreib-Lauf.
// Quellen ohne Login: Google Trends (AT), meistgelesene Wikipedia-Artikel (de, letzte 7 Tage), Reddit r/wien und r/Austria,
// YouTube-Trends AT (nur mit den vorhandenen YouTube-Secrets), Anlässe der nächsten 21 Tage und harmlose ORF-Schlagzeilen.
// Der Wortfilter aus anlaesse.mjs wirft Politik, Unglücke und Kriminalität vorab raus. Personen, Marken und Sport
// filtert er nicht: Die Trends sind nur Anregung für ein Thema aus Resis Alltag, nie Vorlage (siehe autopilot/nachschub.md).
// Jede Quelle darf scheitern, dann steht „nicht erreichbar“ da. Aufruf: node trends.mjs [JJJJ-MM-TT]
import { feste, harmlos, schlagzeilen } from "./anlaesse.mjs";

const datum = (import.meta.url === `file://${process.argv[1]}` && process.argv[2]) || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
const UA = { "user-agent": "oida-leberkas-trends/1.0 (https://oidaleberkas.at)" };
const MAX = 15;

const entities = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
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

const googleTrends = async () => googleLesen(await (await holen("https://trends.google.com/trending/rss?geo=AT")).text());

async function wikipedia(datum) {
  // Die Tages-Toplisten der letzten 7 Tage zusammenzählen
  const summe = new Map();
  for (let i = 1; i <= 7; i++) {
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
const reddit = async (sub) => redditLesen(await (await holen(`https://www.reddit.com/r/${sub}/top/.rss?t=week&limit=25`)).text());

async function youtube() {
  const { YOUTUBE_CLIENT_ID: id, YOUTUBE_CLIENT_SECRET: secret, YOUTUBE_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) throw new Error("keine YouTube-Secrets");
  const token = await (await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }) })).json();
  if (!token.access_token) throw new Error(token.error || "kein Token");
  const j = await (await holen("https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=AT&maxResults=25", { headers: { ...UA, authorization: `Bearer ${token.access_token}` } })).json();
  return j.items.map((v) => `${v.snippet.title} (${v.snippet.channelTitle})`);
}

export function anlaesse(datum) {
  const liste = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(Date.parse(datum + "T12:00:00Z") + i * 864e5).toISOString().slice(0, 10);
    // Dauer-Hinweise (Christkindlmärkte, Ballsaison) nur am ersten Tag, sonst steht jeder Tag voll
    // „(in 2 Tagen)“-Vorwarnungen fallen weg, der Tag selbst steht ja da
    const f = feste(d).filter((a) => !/\(in \d/.test(a) && (i === 0 || !/haben offen|Ballsaison|Schulbeginn|Hochsommer/.test(a)));
    if (f.length) liste.push(`${d}: ${f.join("; ")}`);
  }
  return liste;
}

export async function trends(datum) {
const quellen = [
  ["Google Trends Österreich (Suchanfragen der letzten Tage)", googleTrends],
  ["Wikipedia de, meistgelesen (letzte 7 Tage)", () => wikipedia(datum)],
  ["Reddit r/wien, Top der Woche", () => reddit("wien")],
  // Reddit antwortet auf zwei Abrufe kurz hintereinander mit 429, deshalb eine kleine Pause
  ["Reddit r/Austria, Top der Woche", async () => { await new Promise((r) => setTimeout(r, 5000)); return reddit("Austria"); }],
  ["YouTube-Trends Österreich", youtube],
  ["ORF-Schlagzeilen (Wien, Science, Ö3, FM4)", schlagzeilen],
];

const teile = [`## Trends ${datum}`, "", "Nur Anregung: Thema in Resis Alltag übersetzen, nie Personen, Marken, Politik, Unglücke oder fremde Memes übernehmen (autopilot/nachschub.md).", ""];
teile.push("**Anlässe der nächsten 21 Tage:**", ...anlaesse(datum).map((a) => `- ${a}`), "");
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

if (import.meta.url === `file://${process.argv[1]}`) console.log(await trends(datum));
