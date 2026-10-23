// Aufbau eines Eintrags (ein Post) und Hilfen, die Rendern, Posten und Holen gemeinsam brauchen.
// Ein Eintrag kommt fertig geschrieben aus der Warteschlange (Issue mit Label „warteschlange“).
import { z } from "zod";

const Antwort = z.object({
  format: z.literal("antwort"),
  von: z.string().min(1).max(40).describe("Wer kommentiert hat, z. B. kollegin.sunny"),
  kommentar: z.string().min(1).max(110),
  zeilen: z.array(z.string().min(1).max(45)).min(1).max(3).describe("Resis Antwort, eine Zeile pro Kasten"),
});
const Notiz = z.object({
  format: z.literal("notiz"),
  titel: z.string().min(1).max(30),
  absaetze: z.array(z.string().min(1).max(140)).min(2).max(5),
});
const Bewertung = z.object({
  format: z.literal("bewertung"),
  nr: z.number().int().positive(),
  ort: z.string().min(1).max(45),
  saerge: z.number().int().min(0).max(5),
  text: z.string().min(1).max(140),
});
const Chat = z.object({
  format: z.literal("chat"),
  name: z.string().min(1).max(24),
  nachrichten: z.array(z.object({ wer: z.enum(["sie", "ich", "zeit"]), text: z.string().min(1).max(80) })).min(3).max(9),
});
const Szene = z.object({
  format: z.literal("szene"),
  satz: z.string().min(1).max(130),
  klammern: z.array(z.string().min(1).max(40)).min(1).max(3),
});

// Handy-Oberflächen über einem Bild (seit 19.10.2026)
const t = (max) => z.string().min(1).max(max);
const Mitteilungen = z.object({
  format: z.literal("mitteilungen"),
  mitteilungen: z.array(z.object({ app: t(16), zeit: t(12), titel: t(30), text: t(80) })).min(2).max(4).describe("die letzte ist die Pointe"),
});
const Termin = z.object({ format: z.literal("termin"), datum: t(30), titel: t(24), zeit: t(24), zeilen: z.array(t(45)).min(1).max(3).describe("Pointe, z. B. Wiederholung und Erinnerung") });
const Wetter = z.object({ format: z.literal("wetter"), ort: t(16), temperatur: t(5), lage: t(16), gefuehlt: t(18).describe("Pointe nach „Gefühlt:“"), zusatz: t(36) });
const Umfrage = z.object({ format: z.literal("umfrage"), frage: t(40), optionen: z.array(z.object({ text: t(24), prozent: z.number().int().min(0).max(100) })).min(2).max(3), fuss: t(40) });
const Wiedergabe = z.object({ format: z.literal("wiedergabe"), titel: t(50), kuenstler: t(24), position: t(10), dauer: t(10), fortschritt: z.number().int().min(0).max(100) });
const Sprachnachricht = z.object({ format: z.literal("sprachnachricht"), name: t(24), dauer_sie: t(6), dauer_ich: t(6), transkript: t(40) });
const Suchverlauf = z.object({ format: z.literal("suchverlauf"), eingabe: t(20), vorschlaege: z.array(t(40)).min(3).max(5) });
const Fehlermeldung = z.object({ format: z.literal("fehlermeldung"), titel: t(24), text: t(110), knopf_links: t(18), knopf_rechts: t(18).describe("Pointe, pinker Knopf") });
const Todo = z.object({ format: z.literal("todo"), titel: t(20), punkte: z.array(z.object({ text: t(28), erledigt: z.boolean() })).min(3).max(5), fazit: t(45) });
const Beleg = z.object({ format: z.literal("beleg"), titel: t(18), untertitel: t(24), posten: z.array(z.object({ name: t(12), menge: t(8) })).min(3).max(6), summe: t(10), fuss: t(70) });

// Formate 11–30 (seit 19.10.2026)
const Storyfrage = z.object({ format: z.literal("storyfrage"), frage: t(60), antwort: t(60) });
const Aktivitaet = z.object({ format: z.literal("aktivitaet"), ringe: z.array(z.object({ name: t(12), wert: t(26), prozent: z.number().int().min(0).max(100) })).length(3), fazit: t(50) });
const Akku = z.object({ format: z.literal("akku"), name: t(20), prozent: z.number().int().min(0).max(100), text: t(90), knopf_links: t(16), knopf_rechts: t(20) });
const Abwesenheit = z.object({ format: z.literal("abwesenheit"), betreff: t(30), zeilen: z.array(t(60)).min(2).max(3).describe("die letzte ist die Pointe"), gruss: t(45) });
const Sendung = z.object({ format: z.literal("sendung"), nummer: t(20), titel: t(26), schritte: z.array(z.object({ text: t(32), zeit: t(50), erledigt: z.boolean() })).min(3).max(5).describe("der letzte ist die Pointe") });
const Horoskop = z.object({ format: z.literal("horoskop"), zeichen: t(14), symbol: z.enum(["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"]), text: t(60), werte: z.array(z.object({ name: t(10), saerge: z.number().int().min(0).max(5) })).min(2).max(3) });
const Uebersetzer = z.object({ format: z.literal("uebersetzer"), von: t(14), nach: t(14), original: t(60), uebersetzung: t(40) });
const Ladebalken = z.object({ format: z.literal("ladebalken"), titel: t(32), prozent: z.number().int().min(0).max(100), rest: t(20), fuss: t(50) });
const Navigation = z.object({ format: z.literal("navigation"), anweisung: t(22), detail: t(40), ankunft: t(8), info: t(30) });
const Passwort = z.object({ format: z.literal("passwort"), regeln: z.array(z.object({ text: t(40), erfuellt: z.boolean() })).min(3).max(5).describe("die letzte ist die Pointe") });
const Notfallkontakt = z.object({ format: z.literal("notfallkontakt"), name: t(20), symbol: t(4), untertitel: t(30), zeilen: z.array(z.object({ name: t(14), wert: t(24) })).min(2).max(4) });
const Fokus = z.object({ format: z.literal("fokus"), titel: t(20), status: t(30), text: t(90), ausnahmen: t(24) });
const Gruppe = z.object({ format: z.literal("gruppe"), name: t(24), neu: t(30), frage: t(30), knoepfe: z.array(t(12)).min(2).max(3).describe("der letzte wird gewählt") });
const Speicher = z.object({ format: z.literal("speicher"), titel: t(26), belegt: t(30), posten: z.array(z.object({ name: t(34), groesse: t(10), prozent: z.number().int().min(0).max(100) })).min(2).max(5) });
const Timer = z.object({ format: z.literal("timer"), label: t(20), zeit: t(9), fuss: t(50) });
const Konto = z.object({ format: z.literal("konto"), stand: t(12), umsaetze: z.array(z.object({ name: t(22), betrag: t(12) })).min(2).max(5), fuss: t(45) });
const Einladung = z.object({ format: z.literal("einladung"), von: t(20), titel: t(26), details: t(45), grund: t(30) });
const Update = z.object({ format: z.literal("update"), titel: t(28), zeilen: z.array(z.object({ name: t(20), wert: t(24) })).min(2).max(4), knopf_links: t(18), knopf_rechts: t(16) });
const Serie = z.object({ format: z.literal("serie"), zahl: t(12), text: t(32), fuss: t(45) });
// Mini-Szene aus 3 bis 4 Bildern (Dominik 23.10.2026, Vorbild @shi_illustrator): jede Szene hat ein eigenes Bild aus der Bibliothek,
// einen Satz und bis zu zwei Zeilen darunter. Die letzte Zeile der letzten Szene ist die Pointe.
const Geschichte = z.object({
  format: z.literal("geschichte"),
  szenen: z.array(z.object({ bild: t(80), satz: t(60), klammern: z.array(t(40)).max(2).default([]) })).min(3).max(4).describe("nur Hochformat-Szenen mit kopf, jedes Bild nur einmal"),
});
const Captcha = z.object({ format: z.literal("captcha"), aufgabe: t(20), symbole: z.array(t(4)).length(9), fuss: t(20), knopf: t(14) });

export const Inhalt = z.discriminatedUnion("format", [Antwort, Notiz, Bewertung, Chat, Szene, Mitteilungen, Termin, Wetter, Umfrage, Wiedergabe, Sprachnachricht, Suchverlauf, Fehlermeldung, Todo, Beleg,
  Storyfrage, Aktivitaet, Akku, Abwesenheit, Sendung, Horoskop, Uebersetzer, Ladebalken, Navigation, Passwort,
  Notfallkontakt, Fokus, Gruppe, Speicher, Timer, Konto, Einladung, Update, Serie, Captcha, Geschichte]);

export const Eintrag = z.object({
  inhalt: Inhalt,
  bild: z.string().optional().describe("Dateiname aus bibliothek.json; bei notiz und chat nicht nötig"),
  caption: z.string().min(1).max(400),
  aufforderung: z.string().max(200).default(""),
  hashtags: z.array(z.string().regex(/^#\S+$/)).max(6).default([]),
  musik: z.string().nullable().optional(),
  herbert: z.boolean().optional().describe("Pop-up, das Herbert vorstellt; ohne Angabe von selbst, wenn Herbert im Text steht"),
}).transform((e) => (e.inhalt.format === "geschichte" && !e.bild ? { ...e, bild: e.inhalt.szenen.at(-1).bild } : e));

// Alle Bilder eines Eintrags: bei geschichte jedes Szenenbild (bild ist dort das Bild der letzten Szene), sonst bild
export const bilderVon = (e) => [...new Set([...(e.inhalt?.format === "geschichte" ? (e.inhalt.szenen || []).map((s) => s.bild) : []), ...(e.bild ? [e.bild] : [])].filter(Boolean))];
// Texte einer Szene in Lesereihenfolge
const szenenTexte = (s) => [s.satz, ...(s.klammern || [])];

// Text für Caption, YouTube-Beschreibung und die Sammelliste
export const captionText = (e) => [e.caption, e.aufforderung, (e.hashtags || []).join(" ")].filter(Boolean).join("\n\n");

// Setup und Pointe der Formate 11–30, für Kurzfassung, Titel und die Standzeiten im Reel
export function setupPointe(i) {
  const ohne = (l) => l.slice(0, -1);
  switch (i.format) {
    case "storyfrage": return [i.frage, i.antwort];
    case "aktivitaet": return [i.ringe.map((r) => `${r.name} ${r.wert}`).join(", "), i.fazit];
    case "akku": return [`${i.name} ${i.prozent} %. ${i.text}`, `${i.knopf_links} / ${i.knopf_rechts}`];
    case "abwesenheit": return [`Abwesend: ${i.betreff}. ${ohne(i.zeilen).join(" ")}`, `${i.zeilen.at(-1)} ${i.gruss}`];
    case "sendung": return [`${i.titel}: ${ohne(i.schritte).map((x) => `${x.text} (${x.zeit})`).join(", ")}`, `${i.schritte.at(-1).text}: ${i.schritte.at(-1).zeit}`];
    case "horoskop": return [`${i.zeichen}, heute`, i.text];
    case "uebersetzer": return [`${i.von}: „${i.original}“`, `${i.nach}: „${i.uebersetzung}“`];
    case "ladebalken": return [`${i.titel} ${i.prozent} %, ${i.rest}`, i.fuss];
    case "navigation": return [`${i.anweisung}, Ankunft ${i.ankunft}`, `${i.detail}. ${i.info}`];
    case "passwort": return [ohne(i.regeln).map((r) => r.text).join(", "), `✕ ${i.regeln.at(-1).text}`];
    case "notfallkontakt": return [`Notfallkontakt: ${i.name}, ${i.untertitel}. ${ohne(i.zeilen).map((z) => `${z.name}: ${z.wert}`).join(", ")}`, `${i.zeilen.at(-1).name}: ${i.zeilen.at(-1).wert}`];
    case "fokus": return [`${i.titel}, ${i.status}. ${i.text}`, `Ausnahmen: ${i.ausnahmen}`];
    case "gruppe": return [`${i.name}, ${i.neu}. ${i.frage}`, i.knoepfe.at(-1)];
    case "speicher": return [`${i.titel}: ${ohne(i.posten).map((p) => `${p.name} ${p.groesse}`).join(", ")}`, `${i.posten.at(-1).name} ${i.posten.at(-1).groesse}`];
    case "timer": return [`${i.label} ${i.zeit}`, i.fuss];
    case "konto": return [`Kontostand ${i.stand}: ${i.umsaetze.map((u) => `${u.name} ${u.betrag}`).join(", ")}`, i.fuss];
    case "einladung": return [`${i.von}: ${i.titel}, ${i.details}`, `Absagen. Grund: ${i.grund}`];
    case "update": return [`${i.titel}: ${i.zeilen.map((z) => `${z.name}: ${z.wert}`).join(", ")}`, `${i.knopf_links} / ${i.knopf_rechts}`];
    case "serie": return [`${i.zahl} ${i.text}`, i.fuss];
    case "captcha": return [`Wähle alle Bilder mit ${i.aufgabe}`, `${i.fuss}. ${i.knopf}`];
    case "geschichte": return [i.szenen.slice(0, -1).flatMap(szenenTexte).join(" "), szenenTexte(i.szenen.at(-1)).join(" ")];
  }
}

export function kurzfassung(i) {
  switch (i.format) {
    case "antwort": return `${i.von}: „${i.kommentar}“ / Resi: „${i.zeilen.join(" ")}“`;
    case "notiz": return `${i.titel}: ${i.absaetze.join(" ")}`;
    case "bewertung": return `Sarg-Bewertung #${i.nr}, ${i.ort}, ${i.saerge}/5: ${i.text}`;
    case "chat": return i.nachrichten.filter((n) => n.wer !== "zeit").map((n) => `${n.wer === "ich" ? "Resi" : "Sie"}: ${n.text}`).join(" / ");
    case "szene": return `${i.satz} ${i.klammern.map((k) => `[${k}]`).join(" ")}`;
    case "mitteilungen": return i.mitteilungen.map((m) => `${m.app}: ${m.titel}, ${m.text}`).join(" / ");
    case "termin": return `Termin ${i.titel}, ${i.zeit}. ${i.zeilen.join(" ")}`;
    case "wetter": return `${i.ort} ${i.temperatur}, ${i.lage}. Gefühlt: ${i.gefuehlt}`;
    case "umfrage": return `${i.frage} ${i.optionen.map((x) => `${x.text} ${x.prozent} %`).join(" / ")}`;
    case "wiedergabe": return `Gerade läuft: ${i.titel} (${i.kuenstler})`;
    case "sprachnachricht": return `${i.name}: Sprachnachricht ${i.dauer_sie} / Resi: ${i.dauer_ich}, „${i.transkript}“`;
    case "suchverlauf": return i.vorschlaege.map((v) => `${i.eingabe} ${v}`).join(" / ");
    case "fehlermeldung": return `${i.titel}: ${i.text} [${i.knopf_links}] [${i.knopf_rechts}]`;
    case "todo": return `${i.titel}: ${i.punkte.map((p) => `${p.erledigt ? "✓" : "○"} ${p.text}`).join(", ")}. ${i.fazit}`;
    case "beleg": return `${i.titel}: ${i.posten.map((p) => `${p.name} ${p.menge}`).join(", ")}. Summe: ${i.summe}`;
    default: return setupPointe(i).join(" / ");
  }
}

// Ein kurzer Titel, z. B. für YouTube
export function titel(i) {
  switch (i.format) {
    case "antwort": return i.zeilen.join(" ");
    case "notiz": return `${i.titel}: ${i.absaetze[0]}`;
    case "bewertung": return `Sarg-Bewertung #${i.nr}: ${i.ort}`;
    case "chat": return `Chat mit ${i.name}`;
    case "szene": return i.satz;
    case "geschichte": return i.szenen[0].satz;
    case "mitteilungen": return i.mitteilungen.at(-1).text;
    case "termin": return `Termin: ${i.titel}`;
    case "wetter": return `Wetter: gefühlt ${i.gefuehlt}`;
    case "umfrage": return i.frage;
    case "wiedergabe": return `Gerade läuft: ${i.titel}`;
    case "sprachnachricht": return `Sprachnachricht von ${i.name}`;
    case "suchverlauf": return `Suchverlauf: ${i.eingabe} …`;
    case "fehlermeldung": return `${i.titel}: ${i.text}`;
    case "todo": return i.fazit;
    case "beleg": return `${i.titel}: ${i.summe}`;
    default: return setupPointe(i)[1];
  }
}
