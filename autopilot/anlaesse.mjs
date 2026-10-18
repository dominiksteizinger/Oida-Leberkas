// Was gerade passiert: feste Anlässe im Jahreslauf, Mondphase und harmlose Schlagzeilen aus Wien.
// Die Schlagzeilen sind nur Anregung; welche taugt, entscheidet das Modell nach den Regeln (siehe regeln.md).

const tag = (d) => new Date(d + "T12:00:00Z");
const plus = (d, n) => new Date(d.getTime() + n * 864e5);
const iso = (d) => d.toISOString().slice(0, 10);

function letzterSonntag(jahr, monat) {
  const d = new Date(Date.UTC(jahr, monat, 0, 12));
  return plus(d, -d.getUTCDay());
}

function ostern(j) {
  const a = j % 19, b = Math.floor(j / 100), c = j % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(Date.UTC(j, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1, 12));
}

function mondphase(d) {
  const alter = (((d - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588 + 29.530588) % 29.530588;
  if (alter < 1.5 || alter > 28) return "Neumond (die dunkelste Nacht des Monats)";
  if (Math.abs(alter - 14.77) < 1.5) return "Vollmond";
  return null;
}

export function feste(datum) {
  const d = tag(datum), j = d.getUTCFullYear(), md = datum.slice(5);
  const liste = [];
  const fest = {
    "01-01": "Neujahr", "01-06": "Heilige Drei Könige", "02-14": "Valentinstag (nur als Anlass für ihre Liebe zur Semmel, nie Dating)",
    "04-01": "1. April", "05-01": "1. Mai, Feiertag, alles hat zu", "06-21": "längster Tag des Jahres, ihr Albtraum",
    "08-15": "Mariä Himmelfahrt, Hochsommer", "10-31": "Halloween", "11-01": "Allerheiligen", "11-02": "Allerseelen",
    "11-11": "Martini und Faschingsbeginn um 11:11", "12-04": "Barbaratag", "12-05": "Krampustag", "12-06": "Nikolo",
    "12-08": "Mariä Empfängnis, Feiertag mitten im Weihnachtsstress", "12-21": "längste Nacht des Jahres, ihr Feiertag",
    "12-24": "Heiliger Abend", "12-25": "Christtag", "12-26": "Stefanitag", "12-31": "Silvester",
    "10-04": "Welttierschutztag (Kren!)",
  };
  if (fest[md]) liste.push(fest[md]);
  if (d.getUTCDate() === 13 && d.getUTCDay() === 5) liste.push("Freitag, der 13.");
  for (const [s, text] of [[letzterSonntag(j, 3), "Zeitumstellung auf Sommerzeit: eine Stunde Nacht weniger"], [letzterSonntag(j, 10), "Zeitumstellung auf Winterzeit: eine Stunde Nacht mehr"]]) {
    const abstand = Math.round((s - d) / 864e5);
    if (abstand === 0) liste.push(text);
    else if (abstand > 0 && abstand <= 2) liste.push(`${text} (in ${abstand} Tag${abstand > 1 ? "en" : ""})`);
  }
  const advent4 = plus(tag(`${j}-12-25`), -(tag(`${j}-12-25`).getUTCDay() || 7));
  [3, 2, 1, 0].forEach((w, i) => { if (iso(plus(advent4, -7 * w)) === datum) liste.push(`${i + 1}. Adventsonntag`); });
  const o = ostern(j);
  for (const [n, text] of [[-47, "Faschingsdienstag"], [-46, "Aschermittwoch, Heringschmaus"], [0, "Ostersonntag"], [1, "Ostermontag"]]) {
    if (iso(plus(o, n)) === datum) liste.push(text);
  }
  const m = d.getUTCMonth() + 1, t = d.getUTCDate();
  if ((m === 11 && t >= 14) || (m === 12 && t <= 23)) liste.push("Christkindlmärkte und Punschstände haben offen");
  if (m === 1 || m === 2) liste.push("Ballsaison in Wien");
  if (m === 9 && t <= 10) liste.push("Schulbeginn, die Stadt wird wieder voll");
  if (m === 7 || m === 8) liste.push("Hochsommer, Hitze, Freibad-Saison (ihr Albtraum)");
  const mond = mondphase(d);
  if (mond) liste.push(mond);
  return liste;
}

// Schlagzeilen aus Wien (ORF). Fehler oder kein Netz: leere Liste, der Lauf geht weiter.
export async function schlagzeilen() {
  try {
    const xml = await (await fetch("https://rss.orf.at/wien.xml", { signal: AbortSignal.timeout(8000) })).text();
    return [...xml.matchAll(/<item[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/g)]
      .map((m) => m[1].trim().replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'"))
      .slice(0, 15);
  } catch {
    return [];
  }
}
