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
  satz: z.string().min(1).max(90),
  klammern: z.array(z.string().min(1).max(40)).min(1).max(3),
});

export const Inhalt = z.discriminatedUnion("format", [Antwort, Notiz, Bewertung, Chat, Szene]);

export const Eintrag = z.object({
  inhalt: Inhalt,
  bild: z.string().optional().describe("Dateiname aus bibliothek.json; bei notiz und chat nicht nötig"),
  caption: z.string().min(1).max(400),
  aufforderung: z.string().max(200).default(""),
  hashtags: z.array(z.string().regex(/^#\S+$/)).max(6).default([]),
  musik: z.string().nullable().optional(),
});

// Text für Caption, YouTube-Beschreibung und die Sammelliste
export const captionText = (e) => [e.caption, e.aufforderung, (e.hashtags || []).join(" ")].filter(Boolean).join("\n\n");

export function kurzfassung(i) {
  switch (i.format) {
    case "antwort": return `${i.von}: „${i.kommentar}“ / Resi: „${i.zeilen.join(" ")}“`;
    case "notiz": return `${i.titel}: ${i.absaetze.join(" ")}`;
    case "bewertung": return `Sarg-Bewertung #${i.nr}, ${i.ort}, ${i.saerge}/5: ${i.text}`;
    case "chat": return i.nachrichten.filter((n) => n.wer !== "zeit").map((n) => `${n.wer === "ich" ? "Resi" : "Sie"}: ${n.text}`).join(" / ");
    case "szene": return `${i.satz} ${i.klammern.map((k) => `[${k}]`).join(" ")}`;
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
  }
}
