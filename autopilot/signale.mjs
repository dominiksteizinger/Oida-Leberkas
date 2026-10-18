// Sammelt die Wien-Signale des Tages (Wetter, Anlässe, harmlose Schlagzeilen) als Markdown.
// Der Workflow hängt sie an das Issue mit Label „signale“; wer die Posts schreibt, liest sie dort.
import { feste, schlagzeilen } from "./anlaesse.mjs";

const datum = process.argv[2] || new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
const wochentag = new Intl.DateTimeFormat("de-AT", { timeZone: "Europe/Vienna", weekday: "long" }).format(new Date(datum + "T12:00:00"));

async function wetter() {
  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=48.21&longitude=16.37&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunset&timezone=Europe%2FVienna&forecast_days=2";
    const d = (await (await fetch(url)).json()).daily;
    return d.time.map((t, i) => {
      const c = d.weather_code[i];
      const art = c === 0 ? "klar und sonnig" : c <= 3 ? "bewölkt" : c <= 48 ? "neblig" : c <= 67 ? "Regen" : c <= 77 ? "Schnee" : c <= 82 ? "Regenschauer" : "Gewitter";
      return `${t}: ${art}, ${Math.round(d.temperature_2m_min[i])} bis ${Math.round(d.temperature_2m_max[i])} Grad, ${d.precipitation_sum[i]} mm, Sonnenuntergang ${d.sunset[i].slice(11)}`;
    });
  } catch {
    return ["unbekannt"];
  }
}

const anlaesse = feste(datum);
const news = await schlagzeilen();
console.log(`## Signale ${datum} (${wochentag})

**Wetter Wien:**
${(await wetter()).map((w) => `- ${w}`).join("\n")}

**Anlässe:** ${anlaesse.join("; ") || "keine besonderen"}

**Schlagzeilen** (vorgefiltert, nur als Anregung, die meisten taugen nicht):
${news.map((n) => `- ${n}`).join("\n") || "- keine"}`);
