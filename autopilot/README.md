# Autopilot

Postet zweimal am Tag für Resi Requiem: um **7:00** und um **16:00** Wiener Zeit (`.github/workflows/autopilot.yml`). GitHub startet geplante Läufe oft Stunden zu spät oder gar nicht, deshalb läuft der Cron stündlich. Jeder Lauf holt den fälligen Slot nach (7 bis 13 Uhr den Morgenpost, ab 16 Uhr den Nachmittagspost). Nach erfolgreichem Instagram-Post schreibt der Lauf `tagebuch/<id>/gepostet.txt`; gibt es die Datei, tun spätere Läufe nichts. Scheitert das Posten, versucht es der nächste Lauf noch einmal mit demselben Post. Probeläufe per Hand: Actions → Autopilot → Run workflow (Datum und Slot wählbar).

Der Autopilot schreibt keine Texte mehr selbst und braucht keine Claude-API. Die Posts entstehen im Chat mit Claude und landen fertig in der Warteschlange.

## Ablauf eines Laufs

1. **Signale** (nur um 7): Wetter für Wien (Open-Meteo, mit Sonnenuntergang), Feiertage und Anlässe als Kommentar im Issue mit Label `signale`. Daraus entstehen die nächsten Posts.
2. `holen.mjs`: nimmt den nächsten offenen Post aus der Warteschlange (Posts mit `bis` zuerst, sonst den ältesten) (Issues mit Label `warteschlange`) und prüft ihn. Fehlerhafte Posts bekommen einen Kommentar und das Label `fehler`. Ist nichts da, öffnet der Lauf ein Issue mit Label `leer` und weist es Dominik zu.
3. `render.mjs`: rendert `tagebuch/<datum>-<slot>/post-a.jpg` (nur Setup), `post.jpg` (ganzer Post) und `schritt-NN.jpg` plus `schritte.json` (die neuen Teile einzeln aufgedeckt) und trägt ihn in `tagebuch/eintraege.json` ein. Die Startseite zeigt die neuesten Einträge.
4. `video.mjs`: macht daraus ein Reel (1080x1920, Vollbild): erst das Setup, dann erscheint jeder neue Teil (Zeile, Blase, Absatz) einzeln, die Standzeit richtet sich nach der Textlänge. Chat-Blasen und Notiz-Absätze erscheinen von Anfang an nacheinander. Fotos füllen den ganzen Schirm, am Gesicht ausgerichtet (`kopf` in `bibliothek.json`), mit langsamem Zoom; Karten bleiben ruhig darüber, ohne Untertitel (Text im Bild wird gesprochen; `UNTERTITEL=an` schaltet sie wieder ein), in den sicheren Zonen (oben ca. 285 px, unten ca. 285 px frei) und unter dem Gesicht. Querformat-Bilder liegen scharf auf einem unscharfen Vollbild-Hintergrund, Reaktionsbilder und Karten ohne Bild zoomen als Ganzes leicht. Eine Aufforderung im Kartentext („Schick das …“) kommt im Reel nie zuerst, sondern als letzter Schritt.
5. `posten.mjs`: Instagram als Reel (oder Bild) und, wenn `FACEBOOK_POSTEN=an`, Facebook-Seite.
6. `youtube.mjs`: das Reel als YouTube Short, wenn `YOUTUBE_POSTEN=an`.
7. Danach wird das Warteschlangen-Issue geschlossen und der Post kommt zur Bewertung in die Sammelliste.
8. `vorrat.mjs`: Passen heute weniger als 7 Bilder (ungenutzte plus recycelbare nach Abstandsregel, siehe „Bild-Recycling“), öffnet der Lauf ein Issue mit Label `bilder` und weist es Dominik zu. Das ist die Erinnerung, neue Bilder in Gemini zu machen.

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
- `ab`, `bis` (optional, `JJJJ-MM-TT`): Post nur in diesem Zeitraum, für Anlässe (Allerheiligen, 11.11., Freitag der 13.). Vor `ab` wird der Post übersprungen und bleibt in der Warteschlange, nach `bis` bekommt das Issue einen Kommentar und das Label `fehler` („Anlass vorbei“). Posts mit `bis` (Anlass oder Trend) kommen vor allen freien Posts dran, das früheste Ende zuerst (`reihenfolge.mjs`, seit 20.10.2026).
- `musik` (optional): wird ignoriert, die Reels laufen ohne Ton. Die alten Tracks und `musik_generator.py` liegen in der Git-Historie.
- Nur Issues mit dem Label `warteschlange` zählen, und nur, wenn der Repo-Owner sie angelegt hat. Die Vorlage setzt das Label auch bei Fremden, deshalb filtert `holen.mjs` nach dem Absender.

## Nachschub und Trends (seit 20.10.2026)

Jeden Sonntag sammelt `trends.yml` (`trends.mjs`), was in Österreich und Deutschland gerade Thema ist (Google Trends, Wikipedia, YouTube, acht Subreddits von r/wien bis r/teenagers, Schulferien Wien, kuriose Aktionstage, ORF, Kommentare unter unseren Posts), ins Issue mit Label `trends`. Am Sonntagabend schreibt ein geplanter Claude-Lauf daraus und aus den Anlässen neue Posts, bis die Warteschlange wieder drei Wochen reicht. Ablauf: `nachschub.md`. Werkzeuge dafür:

- `node pruefen.mjs neu.json --warteschlange offen.json --issues issues.json`: prüft neue Posts mit denselben Regeln wie `holen.mjs` (Schema, Wortfilter, Bild, ab/bis, Saisonbilder, doppelt belegte Bilder) und baut die Issue-Texte.
- `node vorschau.mjs neu.json <ordner>`: rendert die Posts als fertige Bilder, ohne Tagebuch und Webseite zu ändern.
- Optionales Feld `trend` im Post-JSON: Herkunft eines Trend-Posts (nur zur Nachverfolgung, wird nicht gepostet).

## Wortfilter und Humor-Quote (seit 19.10.2026)

- **Wortfilter** (`wortfilter.mjs`): Kommen Leberkäse, Leberkas oder Semmel (auch 🥖) in Text, Namen, Caption, Aufforderung oder Hashtags vor, lehnt `holen.mjs` den Post ab (Kommentar plus Label `fehler`), `posten.mjs` prüft vor dem Posten noch einmal. Der Bildname zählt nicht, im Bild bleibt die Semmel als Easter Egg.
- **Humor-Quote** (`humorquote.mjs`): Optionales Feld `mechanik` im Post-JSON, ein kleingeschriebenes Wort, z. B. `"mechanik": "absage"` für „Resi weist ab / sagt knapp Nein“. Höchstens 2 gleiche Mechaniken hintereinander und höchstens 3 von 14 Posts. Sonst wird der Post zurückgestellt und ein anderer kommt dran. Passt nichts anderes, geht er trotzdem raus und Dominik bekommt ein Issue mit Label `mechanik`. Anlass-Posts (`ab`/`bis`) werden nie zurückgestellt. Posts ohne `mechanik` zählen nicht.
- Tests: `node --test autopilot/*.test.mjs`

## Heartbeat (seit 19.10.2026)

`heartbeat.yml` läuft stündlich über den GitHub-Cron, unabhängig von cron-job.org. Ist der Morgenslot um 12 Uhr oder der Nachmittagsslot um 20 Uhr (Wien) noch nicht gepostet, legt `heartbeat.mjs` ein Issue „Slot … nicht gepostet“ (Label `ausfall`) an, mit dem letzten Autopilot-Lauf und der wahrscheinlichen Ursache (kein Lauf = cron-job.org prüfen). Es schließt sich, sobald der Slot nachgeholt ist. Nur bei `POSTEN` = `an`.

Weil der GitHub-Cron selbst oft spät kommt, kann cron-job.org den Heartbeat zusätzlich anstoßen: zwei weitere Jobs wie die bestehenden (POST auf `.../actions/workflows/heartbeat.yml/dispatches`, Body `{"ref":"main"}`, gleicher Token) um 12:20 und 20:20 Europe/Vienna.

## Wochenauswertung (seit 19.10.2026)

`messung.yml` läuft jeden Montag um 5:30 UTC (per Hand: Actions → Wochenauswertung → Run workflow). `messung.mjs` holt für die geposteten Posts der letzten 28 Tage die Instagram-Insights (Views, Reichweite, Shares, Saves, Likes, Kommentare, Ø Wiedergabezeit) und YouTube Analytics (Views, Ø Wiedergabedauer und -anteil, Likes, Shares) und schreibt `auswertung/<datum>.md`, gruppiert nach Format, Aufforderung, Slot und Mechanik. Der Bericht hängt auch als Kommentar am Issue „Wochenauswertung“ (Label `auswertung`). Zuordnung: Instagram über die Caption, YouTube über den Titel. Fehlen Token oder Rechte, steht „übersprungen“ mit Grund im Bericht. Welche Rechte nötig sind: `messung-anleitung.md`.

## Stimmen-Cache

Jeder gesprochene Satz liegt als Opus-Datei in `stimme-cache/` (Schlüssel: Stimme plus Text). Der Workflow „Stimmen vorab“ (`stimme-vorab.mjs`, 08:30 und 20:30 UTC, nur mit `STIMME` = `an`) rendert alle Posts der Warteschlange, sammelt die Sätze und füllt den Cache vor, höchstens 100 neue Sätze pro Lauf mit 8 s Abstand, damit das Free-Tier-Limit von Gemini-TTS hält. Bei einem 429 hört der Lauf auf und macht am nächsten Termin weiter. Per Hand: Actions → Stimmen vorab → Run workflow. Datum und Uhrzeit der Notizen-Oberfläche werden nicht gesprochen (`sprechtext` in `stimme.mjs`), sonst träfe der Cache nie.

Fällt die Stimme beim Posten trotzdem aus (Limit, Schlüssel), geht das Reel stumm raus, und der Lauf legt das Issue „Reel ohne Stimme gepostet“ (Label `stimme`) für Dominik an.

## Einstellungen (Settings → Secrets and variables → Actions → Variables)

- `POSTEN` = `an`: echter Betrieb (nur auf `main`). Ohne diese Variable läuft alles im Probebetrieb auf dem Branch `autopilot-probe` und es wird nichts gepostet.
- `FACEBOOK_POSTEN` = `an`: zusätzlich auf der Facebook-Seite posten.
- `YOUTUBE_POSTEN` = `an`: Reel als Short hochladen. `YOUTUBE_SICHTBARKEIT` = `private` oder `unlisted` zum Testen.
- `HANDLE`: Name im Post, Standard `resi.requiem`.
- `JINGLE` = `an`: Jingle ins Reel mischen. Braucht die Datei `autopilot/assets/jingle.mp3` (3 bis 5 s, höchstens 6 s). Fehlt die Datei, läuft das Reel ohne Jingle wie bisher. Standard ist das Ende: Das letzte Standbild steht, bis der Jingle durch ist. `JINGLE_POS` = `anfang` setzt ihn vor die Stimme.

## Bewertung

Jeder Post hängt als Kommentar an der Sammelliste (Label `sammelliste`). 👍 oder 👎 am Kommentar, oder ein eigener Kommentar, der mit `gut` oder `schlecht` beginnt. Claude liest das, bevor neue Posts geschrieben werden.

## Bilder

- `bilder/` ist die Bibliothek, `bibliothek.json` beschreibt jedes Bild in einer Zeile: `szene` für Bilder mit Hintergrund, `figur` für Reaktionsbilder auf Weiß (für das Format `antwort`), dazu `tags`, `gesicht` (`ja`, wenn Gesicht und Augen gut zu sehen sind; `bildwahl.mjs` schlägt diese Bilder zuerst vor) und bei Szenen im Hochformat `kopf` = [Gesichtsmitte x, Kinn y] als Anteil der Bildgröße (Bildausschnitt und Kartenlage im Reel). Der Reel-Ausschnitt bleibt möglichst mittig, damit Herbert & Co. drin bleiben; liegt etwas Wichtiges am Rand, setzt `mitte` (0 bis 1) die Bildmitte.

### Bild-Recycling (seit 19.10.2026)

Hintergrundbilder dürfen mit neuem Text wieder verwendet werden. Regeln in `bildregeln.mjs`, Tests in `bildregeln.test.mjs` (`node --test autopilot/bildregeln.test.mjs`).

- `tags`: `neutral`, Jahreszeit (`herbst`, `winter`) oder Anlass (`advent`, `weihnachten`, `silvester`, `halloween`, `allerheiligen`, `zeitumstellung`). Neue Tags mit Zeitraum in `bildregeln.mjs` eintragen.
- Anlassbilder kommen nur in ihrem Zeitraum und nur einmal. Jahreszeit-Bilder nur in ihrer Jahreszeit, dort recycelbar. Neutrale Bilder immer.
- Ungenutzte Bilder haben Vorrang. Erst wenn keins mehr passt, kommt ein schon verwendetes, frühestens nach 21 Tagen, das am längsten nicht verwendete zuerst. Nie dasselbe Bild am selben oder am Folgetag.
- Bei einer Wiederverwendung muss der Text neu sein: identischer Inhalt oder identische Caption wie bei einer früheren Nutzung des Bildes wird abgelehnt.
- `nutzung.json` ist der Nutzungsverlauf (Datum, Slot, Bild, Text, Fingerabdruck). `holen.mjs` prüft die Regeln für den gewählten Post und trägt ihn ein; verstößt er dagegen, bekommt das Issue einen Kommentar und das Label `fehler`.
- Bild wählen beim Schreiben: `node autopilot/bildwahl.mjs [JJJJ-MM-TT]` listet die passenden Bilder in Reihenfolge, `node autopilot/bildwahl.mjs --verlauf <datei>` zeigt die früheren Texte eines Bildes. Nicht zwei Posts mit demselben Bild gleichzeitig in die Warteschlange legen.
- Variablen: `BILD_RECYCLING` = `aus` schaltet das Recycling ab (nur ungenutzte Bilder, wie früher). `BILD_ABSTAND_TAGE` ändert den Mindestabstand (Standard 21).
