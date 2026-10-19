# Autopilot

Postet zweimal am Tag für Resi Requiem: um **7:00** und um **16:00** Wiener Zeit (`.github/workflows/autopilot.yml`). GitHub rechnet in UTC, deshalb läuft der Cron zu beiden möglichen UTC-Stunden und der Lauf prüft selbst, ob es in Wien gerade 7 oder 16 Uhr ist. So passt es im Sommer und im Winter, und ein Post geht nie doppelt raus. Probeläufe per Hand: Actions → Autopilot → Run workflow (Datum und Slot wählbar).

Der Autopilot schreibt keine Texte mehr selbst und braucht keine Claude-API. Die Posts entstehen im Chat mit Claude und landen fertig in der Warteschlange.

## Ablauf eines Laufs

1. **Signale** (nur um 7): Wetter für Wien (Open-Meteo, mit Sonnenuntergang), Feiertage und Anlässe als Kommentar im Issue mit Label `signale`. Daraus entstehen die nächsten Posts.
2. `holen.mjs`: nimmt den ältesten offenen Post aus der Warteschlange (Issues mit Label `warteschlange`) und prüft ihn. Fehlerhafte Posts bekommen einen Kommentar und das Label `fehler`. Ist nichts da, öffnet der Lauf ein Issue mit Label `leer` und weist es Dominik zu.
3. `render.mjs`: rendert `tagebuch/<datum>-<slot>/post-a.jpg` (nur Setup) und `post.jpg` (ganzer Post) und trägt ihn in `tagebuch/eintraege.json` ein. Die Startseite zeigt die neuesten Einträge.
4. `video.mjs`: macht daraus ein 8-Sekunden-Reel (Setup, harter Schnitt, Pointe) ohne Ton.
5. `posten.mjs`: Instagram als Reel (oder Bild) und, wenn `FACEBOOK_POSTEN=an`, Facebook-Seite.
6. `youtube.mjs`: das Reel als YouTube Short, wenn `YOUTUBE_POSTEN=an`.
7. Danach wird das Warteschlangen-Issue geschlossen und der Post kommt zur Bewertung in die Sammelliste.
8. `vorrat.mjs`: Sind weniger als 7 Bibliotheksbilder noch nie verwendet worden, öffnet der Lauf ein Issue mit Label `bilder` und weist es Dominik zu. Das ist die Erinnerung, neue Bilder in Gemini zu machen.

## Einen Post in die Warteschlange legen

Neues Issue → Vorlage „Fertiger Post“, oder Claude legt es im Chat an. Im Issue steht ein JSON-Block:

```json
{
  "inhalt": { "format": "antwort", "von": "sunny.kollegin", "kommentar": "Du schaust heute so fertig aus 🥺", "zeilen": ["Danke.", "Hat zwei Stunden gedauert."] },
  "bild": "kaffee-muede.jpg",
  "caption": "Kollegin vs. ich, Folge 5.",
  "aufforderung": "Schick das deiner Sunny.",
  "hashtags": ["#deadpan", "#büro", "#goth", "#wien"],
  "slot": "07"
}
```

- `inhalt.format` ist eines von `antwort`, `notiz`, `bewertung`, `chat`, `szene`. Felder und Längen stehen in `eintrag.mjs`, Ton und Grenzen in `regeln.md`, Beispiele in `beispiele.md`.
  - `antwort`: `von`, `kommentar`, `zeilen` (1–3)
  - `notiz`: `titel`, `absaetze` (2–5, der letzte ist die Pointe)
  - `bewertung`: `nr`, `ort`, `saerge` (0–5), `text`
  - `chat`: `name`, `nachrichten` (`wer`: `sie`, `ich` oder `zeit`)
  - `szene`: `satz`, `klammern` (1–3)
- `bild`: Dateiname aus `bibliothek.json`. Nicht nötig bei `notiz` und `chat`.
- `slot` (optional): `"07"` oder `"16"`, wenn der Post nur zu dieser Uhrzeit raus soll.
- `musik` (optional): wird zurzeit nicht verwendet, die Reels laufen ohne Ton.
- Nur Issues mit dem Label `warteschlange` zählen, und nur, wenn der Repo-Owner sie angelegt hat. Die Vorlage setzt das Label auch bei Fremden, deshalb filtert `holen.mjs` nach dem Absender.

## Einstellungen (Settings → Secrets and variables → Actions → Variables)

- `POSTEN` = `an`: echter Betrieb (nur auf `main`). Ohne diese Variable läuft alles im Probebetrieb auf dem Branch `autopilot-probe` und es wird nichts gepostet.
- `FACEBOOK_POSTEN` = `an`: zusätzlich auf der Facebook-Seite posten.
- `YOUTUBE_POSTEN` = `an`: Reel als Short hochladen. `YOUTUBE_SICHTBARKEIT` = `private` oder `unlisted` zum Testen.
- `HANDLE`: Name im Post, Standard `resi.requiem`.

## Bewertung

Jeder Post hängt als Kommentar an der Sammelliste (Label `sammelliste`). 👍 oder 👎 am Kommentar, oder ein eigener Kommentar, der mit `gut` oder `schlecht` beginnt. Claude liest das, bevor neue Posts geschrieben werden.

## Bilder und Musik

- `bilder/` ist die Bibliothek, `bibliothek.json` beschreibt jedes Bild in einer Zeile: `szene` für Bilder mit Hintergrund, `figur` für Reaktionsbilder auf Weiß (für das Format `antwort`).
- `musik/` enthält lizenzfreie Tracks, `musik.json` beschreibt sie (`datei`, `titel`, `stimmung`, Lizenz). Neue Musik wirft Dominik in den Projektordner `eingang/musik/` mit der Lizenz in `lizenzen.md`.
