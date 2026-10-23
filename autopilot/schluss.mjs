// Schluss-Check (Dominik 22.10.2026: „Fehler nicht wiederholen“). Prüft die letzte Zeile eines neuen Posts gegen die Fehler,
// die schon passiert sind: Schluss als bloße logische Folge oder Zustand („Es ist jetzt Deko.“, „Ich nicht.“), Pointe ohne
// neues konkretes Wort, zu lang, als Frage, mit Trendvokabel oder beim Gegenüber statt bei Resi.
// Grundlage: regeln.md „Gag-Bauplan und Verbote“ und „Witz-Parameter“ (Flach-Test). Die Prüfung ist eine Heuristik:
// Ein bewusst anderer Schluss geht mit `"schluss_ok": "<ein Satz, warum der Schluss trotzdem kippt>"` durch.
// Lockerung (Dominik 23.10.2026: „Filter und was Content bringt stehen sich im Weg“): Muster mit `wiedererkennen: true`
// (witz-muster.json) leben vom „das bin ich“, nicht von einer Kippe. Für sie entfallen Flach-Test und Pflicht zum neuen Wort.
import { setupPointe } from "./eintrag.mjs";
import { MUSTER } from "./witzmuster.mjs";

// Setup (alles vor der Pointe) und Schluss (die letzte Zeile, die der Leser sieht) je Format. null = Format ohne klare letzte Zeile.
export function setupUndSchluss(i) {
  const ohne = (l) => l.slice(0, -1);
  switch (i.format) {
    case "antwort": return { setup: [i.kommentar, ...ohne(i.zeilen)], schluss: i.zeilen.at(-1) };
    case "notiz": return { setup: [i.titel, ...ohne(i.absaetze)], schluss: i.absaetze.at(-1) };
    case "chat": {
      const n = i.nachrichten.filter((x) => x.wer !== "zeit");
      return { setup: [i.name, ...ohne(n).map((x) => x.text)], schluss: n.at(-1).text };
    }
    case "szene": return { setup: [i.satz, ...ohne(i.klammern)], schluss: i.klammern.at(-1) };
    case "geschichte": {
      const t = i.szenen.flatMap((s) => [s.satz, ...(s.klammern || [])]);
      return { setup: ohne(t), schluss: t.at(-1) };
    }
    case "mitteilungen": {
      const m = i.mitteilungen;
      return { setup: [...ohne(m).flatMap((x) => [x.app, x.titel, x.text]), m.at(-1).app, m.at(-1).titel], schluss: m.at(-1).text };
    }
    case "termin": return { setup: [i.datum, i.titel, i.zeit, ...ohne(i.zeilen)], schluss: i.zeilen.at(-1) };
    case "wetter": return { setup: [i.ort, i.lage, i.zusatz], schluss: i.gefuehlt };
    case "umfrage": return { setup: [i.frage, ...i.optionen.map((o) => o.text)], schluss: i.fuss };
    case "sprachnachricht": return { setup: [i.name], schluss: i.transkript };
    case "suchverlauf": return { setup: [i.eingabe, ...ohne(i.vorschlaege)], schluss: i.vorschlaege.at(-1) };
    case "fehlermeldung": return { setup: [i.titel, i.text, i.knopf_links], schluss: i.knopf_rechts };
    case "todo": return { setup: [i.titel, ...i.punkte.map((p) => p.text)], schluss: i.fazit };
    case "beleg": return { setup: [i.titel, i.untertitel, ...i.posten.map((p) => p.name)], schluss: i.fuss };
    case "bewertung": case "wiedergabe": return null;
    default: {
      const sp = setupPointe(i);
      return sp ? { setup: [sp[0]], schluss: sp[1] } : null;
    }
  }
}

// Wörter ohne eigenen Inhalt. Ein Schluss nur aus diesen Wörtern ist eine Reaktion, keine Pointe („Ich nicht.“, „Ich auch.“).
const FUELL = new Set(("ich du er sie es wir ihr man mich dich sich mir dir ihm ihn uns euch mein meine meinen meinem meiner dein deine sein seine ihre ihren " +
  "der die das den dem des ein eine einen einem einer kein keine keinen nicht nichts auch noch schon nur mal halt eben doch ja nein so " +
  "und oder aber denn dass weil wenn als wie was wer wo da dann jetzt hier dort immer nie wieder sehr ganz gar zu zum zur im in an am auf aus bei mit " +
  "nach von vor für über unter um bis ist bin bist sind war hat hab habe haben wird werden kann muss will soll gibt okay ok gut klar stimmt genau").split(" "));
const woerter = (s) => (String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
const inhaltsWoerter = (s) => woerter(s).filter((w) => !FUELL.has(w));

// Schlüsse, die nur einen Zustand beschreiben oder das Setup bestätigen (regeln.md, Flach-Test; Beispiele aus den flachen Posts bis 22.10.2026)
const FLACH = /(^endlich\b|\b(leider|ich auch|fast wie (zu ?hause|daheim)|es ist jetzt|wie immer|wie jedes jahr|typisch|klassiker|same|mood)\b)/i;
// Trendwörter bauen das Setup, die Pointe bleibt ein normaler Satz (Witz-Parameter Punkt 6)
const TREND = /\b(red ?flag|green ?flag|ick|slay|delulu|situationship|ghost(ing|en)?|cringe|lol|lmao|rizz|vibe|era|pov)\b/i;
export const SCHLUSS = { maxWoerter: 12, maxAbsage: 8 };

export function pruefeSchluss(post) {
  if (typeof post.schluss_ok === "string" && post.schluss_ok.trim().length >= 10) return [];
  const t = post.inhalt ? setupUndSchluss(post.inhalt) : null;
  if (!t || !t.schluss) return [];
  const s = t.schluss.trim();
  const fehler = [];
  const hinweis = " (bewusst so: \"schluss_ok\": \"<warum es trotzdem kippt>\")";
  const n = woerter(s).length;
  const wiedererkennen = MUSTER[post.muster]?.wiedererkennen === true;
  if (FLACH.test(s) && !wiedererkennen) fehler.push(`Schluss „${s}“ beschreibt nur einen Zustand oder bestätigt das Setup (Flach-Test)${hinweis}`);
  if (/\?\s*[“"]?$/.test(s)) fehler.push(`Schluss „${s}“ ist eine Frage; die Pointe ist eine Aussage von Resi${hinweis}`);
  if (/!/.test(s)) fehler.push(`Schluss „${s}“ hat ein Ausrufezeichen; Resi bleibt deadpan`);
  const max = post.mechanik === "absage" ? SCHLUSS.maxAbsage : SCHLUSS.maxWoerter;
  if (n > max) fehler.push(`Schluss „${s}“ hat ${n} Wörter, höchstens ${max}${post.mechanik === "absage" ? " bei absage" : ""}; Pointe kürzen${hinweis}`);
  if (TREND.test(s)) fehler.push(`Schluss „${s}“ lebt von einem Trendwort („${s.match(TREND)[0]}“); Trendwörter nur im Setup${hinweis}`);
  // Pointe bei Resi: in der Szene endet keine Zeile mit wörtlicher Rede des Gegenübers („„Also schwarz?““, „Er: …“)
  if (post.inhalt.format === "szene" && (/^[„"»]/.test(s) || (/^[\p{L} ]{1,20}:\s*[„"»]/u.test(s) && !/^ich:/i.test(s)))) fehler.push(`Schluss „${s}“ sagt das Gegenüber; die Pointe sagt Resi (Bauplan Punkt 4)`);
  // Neues konkretes Wort: Bringt die letzte Zeile kein Inhaltswort, das im Setup noch nicht stand, ist sie Reaktion oder logische Folge
  const vorher = new Set(t.setup.flatMap(woerter));
  const neu = inhaltsWoerter(s).filter((w) => !vorher.has(w));
  const einWortAbsage = post.mechanik === "absage" && n === 1;
  if (!neu.length && !einWortAbsage && !wiedererkennen) fehler.push(`Schluss „${s}“ bringt kein neues konkretes Wort (nur Reaktion oder Wiederholung des Setups); die Pointe endet auf einem Wort, das kippt (Bauplan Punkt 4)${hinweis}`);
  return fehler;
}
