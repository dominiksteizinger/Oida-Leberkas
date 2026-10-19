# Autopilot

Postet zweimal am Tag für Resi Requiem: um **7:00** und um **16:00** Wiener Zeit (`.github/workflows/autopilot.yml`). GitHub startet geplante Läufe oft Stunden zu spät oder gar nicht, deshalb läuft der Cron stündlich. Jeder Lauf holt den fälligen Slot nach (7 bis 13 Uhr den Morgenpost, ab 16 Uhr den Nachmittagspost). Nach erfolgreichem Instagram-Post schreibt der Lauf `tagebuch/<id>/gepostet.txt`; gibt es die Datei, tun spätere Läufe nichts. Scheitert das Posten, versucht es der nächste Lauf noch einmal mit demselben Post. Probeläufe per Hand: Actions → Autopilot → Run workflow (Datum und Slot wählbar).

Der Autopilot schreibt keine Texte mehr selbst und braucht keine Claude-API. Die Posts entstehen im Chat mit Claude und landen fertig in der Warteschlange.

## Ablauf eines Laufs

1. **Signale** (nur um 7): Wetter für Wien (Open-Meteo, mit Sonnenuntergang), Feiertage und Anlässe als Kommentar im Issue mit Label `signale`. Daraus entstehen die nächsten Posts.
2. `holen.mjs`: nimmt den ältesten offenen Post aus der Warteschlange (Issues mit Label `warteschlange`) und prüft ihn. Fehlerhafte Posts bekommen einen Kommentar und das Label `fehler`. Ist nichts da, öffnet der Lauf ein Issue mit Label `leer` und weist es Dominik zu.
3. `render.mjs`: rendert `tagebuch/<datum>-<slot>/post-a.jpg` (nur Setup), `post.jpg` (ganzer Post) und `schritt-NN.jpg` plus `schritte.json` (die neuen Teile einzeln aufgedeckt) und trägt ihn in `tagebuch/eintraege.json` ein. Die Startseite zeigt die neuesten Einträge.
4. `video.mjs`: macht daraus ein Reel ohne Ton: erst das Setup, dann erscheint jeder neue Teil (Zeile, Blase, Absatz) einzeln, die Standzeit richtet sich nach der Textlänge. Chat-Blasen und Notiz-Absätze erscheinen von Anfang an nacheinander.
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

- `inhalt.format` ist eines von `antwort`, `notiz`, `bewertung`, `chat`, `szene` oder einer der Handy-Oberflächen (seit 19.10.2026) `mitteilungen`, `termin`, `wetter`, `umfrage`, `wiedergabe`, `sprachnachricht`, `suchverlauf`, `fehlermeldung`, `todo`, `beleg`, `storyfrage`, `aktivitaet`, `akku`, `abwesenheit`, `sendung`, `horoskop`, `uebersetzer`, `ladebalken`, `navigation`, `passwort`, `notfallkontakt`, `fokus`, `gruppe`, `speicher`, `timer`, `konto`, `einladung`, `update`, `serie`, `captcha`. Die Felder der Formate ab `storyfrage` stehen nur in `eintrag.mjs`. Felder und Längen stehen in `eintrag.mjs`, Ton und Grenzen in `regeln.md`, Beispiele in `beispiele.md`.
  - `antwort`: `von`, `kommentar`, `zeilen` (1–3)
  - `notiz`: `titel`, `absaetze` (2–5, der letzte ist die Pointe)
  - `bewertung`: `nr`, `ort`, `saerge` (0–5), `text`
  - `chat`: `name`, `nachrichten` (`wer`: `sie`, `ich` oder `zeit`)
  - `szene`: `satz`, `klammern` (1–3 kurze Zeilen unter dem Satz, ohne Klammern dargestellt, erscheinen im Reel nacheinander)
  - `mitteilungen`: `mitteilungen` (2–4, je `app`, `zeit`, `titel`, `text`; die letzte ist die Pointe)
  - `termin`: `datum`, `titel`, `zeit`, `zeilen` (1–3, Pointe)
  - `wetter`: `ort`, `temperatur`, `lage`, `gefuehlt` (Pointe), `zusatz`
  - `umfrage`: `frage`, `optionen` (2–3, je `text`, `prozent`), `fuss`
  - `wiedergabe`: `titel` (Pointe), `kuenstler`, `position`, `dauer`, `fortschritt` (0–100)
  - `sprachnachricht`: `name`, `dauer_sie`, `dauer_ich`, `transkript` (Pointe)
  - `suchverlauf`: `eingabe`, `vorschlaege` (3–5)
  - `fehlermeldung`: `titel`, `text`, `knopf_links`, `knopf_rechts` (Pointe)
  - `todo`: `titel`, `punkte` (3–5, je `text`, `erledigt`), `fazit`
  - `beleg`: `titel`, `untertitel`, `posten` (3–6, je `name`, `menge`), `summe`, `fuss`
- `bild`: Dateiname aus `bibliothek.json`. Nicht nötig bei `notiz` und `chat`.
- `slot` (optional): `"07"` oder `"16"`, wenn der Post nur zu dieser Uhrzeit raus soll.
- `musik` (optional): wird ignoriert, die Reels laufen ohne Ton. Die alten Tracks und `musik_generator.py` liegen in der Git-Historie.
- Nur Issues mit dem Label `warteschlange` zählen, und nur, wenn der Repo-Owner sie angelegt hat. Die Vorlage setzt das Label auch bei Fremden, deshalb filtert `holen.mjs` nach dem Absender.

## Einstellungen (Settings → Secrets and variables → Actions → Variables)

- `POSTEN` = `an`: echter Betrieb (nur auf `main`). Ohne diese Variable läuft alles im Probebetrieb auf dem Branch `autopilot-probe` und es wird nichts gepostet.
- `FACEBOOK_POSTEN` = `an`: zusätzlich auf der Facebook-Seite posten.
- `YOUTUBE_POSTEN` = `an`: Reel als Short hochladen. `YOUTUBE_SICHTBARKEIT` = `private` oder `unlisted` zum Testen.
- `HANDLE`: Name im Post, Standard `resi.requiem`.

## Bewertung

Jeder Post hängt als Kommentar an der Sammelliste (Label `sammelliste`). 👍 oder 👎 am Kommentar, oder ein eigener Kommentar, der mit `gut` oder `schlecht` beginnt. Claude liest das, bevor neue Posts geschrieben werden.

## Bilder

- `bilder/` ist die Bibliothek, `bibliothek.json` beschreibt jedes Bild in einer Zeile: `szene` für Bilder mit Hintergrund, `figur` für Reaktionsbilder auf Weiß (für das Format `antwort`).
