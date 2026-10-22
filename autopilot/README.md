# Autopilot

Postet viermal am Tag für Resi Requiem: um **7:00**, **11:00**, **16:00** und **22:00** Wiener Zeit (`.github/workflows/autopilot.yml`). GitHub startet geplante Läufe oft Stunden zu spät oder gar nicht, deshalb läuft der Cron stündlich. cron-job.org startet den Workflow um 07:17, 11:17, 16:17 und 22:17. Jeder Lauf holt den fälligen Slot nach, bis der nächste beginnt (07: 7 bis 10 Uhr, 11: 11 bis 15 Uhr, 16: 16 bis 21 Uhr, 22: 22 bis 23 Uhr). Ein verpasster Slot wird nicht in den nächsten geschoben, damit nie zwei Posts kurz hintereinander kommen. Nach erfolgreichem Instagram-Post schreibt der Lauf `tagebuch/<id>/gepostet.txt`; gibt es die Datei, tun spätere Läufe nichts. Scheitert das Posten, versucht es der nächste Lauf noch einmal mit demselben Post. Probeläufe per Hand: Actions → Autopilot → Run workflow (Datum und Slot wählbar).

Der Autopilot schreibt keine Texte mehr selbst und braucht keine Claude-API. Die Posts entstehen im Chat mit Claude und landen fertig in der Warteschlange.

## Ablauf eines Laufs

1. **Signale** (nur um 7): Wetter für Wien (Open-Meteo, mit Sonnenuntergang), Feiertage und Anlässe als Kommentar im Issue mit Label `signale`. Daraus entstehen die nächsten Posts.
2. `holen.mjs`: nimmt den nächsten offenen Post aus der Warteschlange (Posts mit `bis` zuerst, sonst den ältesten) (Issues mit Label `warteschlange`) und prüft ihn. Fehlerhafte Posts bekommen einen Kommentar und das Label `fehler`. Ist nichts da, öffnet der Lauf ein Issue mit Label `leer` und weist es Dominik zu.
3. `render.mjs`: rendert `tagebuch/<datum>-<slot>/post-a.jpg` (nur Setup), `post.jpg` (ganzer Post) und `schritt-NN.jpg` plus `schritte.json` (die neuen Teile einzeln aufgedeckt) und trägt ihn in `tagebuch/eintraege.json` ein. Die Startseite zeigt die neuesten Einträge.
4. `video.mjs`: macht daraus ein Reel (1080x1920, Vollbild): erst das Setup, dann erscheint jeder neue Teil (Zeile, Blase, Absatz) einzeln, die Standzeit richtet sich nach der Textlänge. Chat-Blasen und Notiz-Absätze erscheinen von Anfang an nacheinander. Fotos füllen den ganzen Schirm, am Gesicht ausgerichtet (`kopf` in `bibliothek.json`), mit langsamem Zoom; Karten bleiben ruhig darüber, ohne Untertitel (Text im Bild wird gesprochen; `UNTERTITEL=an` schaltet sie wieder ein), in den sicheren Zonen (oben ca. 285 px, unten ca. 285 px frei) und unter dem Gesicht. Querformat-Bilder liegen scharf auf einem unscharfen Vollbild-Hintergrund, Reaktionsbilder und Karten ohne Bild zoomen als Ganzes leicht. Eine Aufforderung im Kartentext („Schick das …“) kommt im Reel nie zuerst, sondern als letzter Schritt.
5. `posten.mjs`: Instagram als Reel (oder Bild) und, wenn `FACEBOOK_POSTEN=an`, Facebook-Seite.
6. `youtube.mjs`: das Reel als YouTube Short, wenn `YOUTUBE_POSTEN=an`.
   `tiktok.mjs`: das Reel zu TikTok, wenn `TIKTOK_POSTEN=an`. Ein Fehler dort bricht den Lauf nicht ab. Entwürfe kommen ohne Text an; der Text steht als Kommentar im Issue „TikTok-Entwürfe: Texte“ (Label `tiktok`).
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
- `bild`: Dateiname aus `bibliothek.json`. Nicht nötig bei `notiz` und `chat`. Bei `szene` richtet sich der Ausschnitt nach `kopf` in `bibliothek.json`, damit das Gesicht im Bild bleibt.
- `herbert` (optional, `true`/`false`): kleines Pop-up „🦇 Herbert, meine Fledermaus“. Kommt von selbst, sobald „Herbert“ im Text steht; `true` erzwingt es (z. B. bei „– H.“), `false` schaltet es ab.
- `slot` (optional): `"07"`, `"11"`, `"16"` oder `"22"`, wenn der Post nur zu dieser Uhrzeit raus soll.
- `ab`, `bis` (optional, `JJJJ-MM-TT`): Post nur in diesem Zeitraum, für Anlässe (Allerheiligen, 11.11., Freitag der 13.). Vor `ab` wird der Post übersprungen und bleibt in der Warteschlange, nach `bis` bekommt das Issue einen Kommentar und das Label `fehler` („Anlass vorbei“). Posts mit `bis` (Anlass oder Trend) kommen vor allen freien Posts dran, das früheste Ende zuerst (`reihenfolge.mjs`, seit 20.10.2026).
- `musik` (optional): wird ignoriert, die Reels laufen ohne Ton. Die alten Tracks und `musik_generator.py` liegen in der Git-Historie.
- Nur Issues mit dem Label `warteschlange` zählen, und nur, wenn der Repo-Owner sie angelegt hat. Die Vorlage setzt das Label auch bei Fremden, deshalb filtert `holen.mjs` nach dem Absender.

## Nachschub und Trends (seit 20.10.2026)

Jeden Sonntag sammelt `trends.yml` (`trends.mjs`), was in Österreich und Deutschland gerade Thema ist (Google Trends, Wikipedia, YouTube, acht Subreddits von r/wien bis r/teenagers, Schulferien Wien, kuriose Aktionstage, ORF, Kommentare unter unseren Posts), ins Issue mit Label `trends`. Am Sonntagabend schreibt ein geplanter Claude-Lauf daraus und aus den Anlässen neue Posts, bis die Warteschlange wieder drei Wochen reicht. Ablauf: `nachschub.md`. Werkzeuge dafür:

- `node pruefen.mjs neu.json --warteschlange offen.json --issues issues.json`: prüft neue Posts mit denselben Regeln wie `holen.mjs` (Schema, Wortfilter, Bild, ab/bis, Saisonbilder, doppelt belegte Bilder) und baut die Issue-Texte.
- `node vorschau.mjs neu.json <ordner>`: rendert die Posts als fertige Bilder, ohne Tagebuch und Webseite zu ändern.
- Optionales Feld `trend` im Post-JSON: Herkunft eines Trend-Posts (nur zur Nachverfolgung, wird nicht gepostet).

## Storys (seit 20.10.2026)

`.github/workflows/storys.yml` postet zwei Instagram-Storys am Tag als Standbild (1080x1920), zusätzlich zu den Posts. Gratis, keine Claude-API. Jeder Autopilot-Lauf stößt am Ende `storys.yml` an (cron-job.org 11:17 = Mittag, 16:17 direkt nach dem Post = Abend, 22:17 Nachholen); der stündliche GitHub-Cron ist nur Reserve, weil er oft ausfällt. `storys.mjs` ordnet die Wiener Uhrzeit dem Slot zu:

- **Mittag (11 bis 15 Uhr):** eine Karte aus `storys.json`. Anlass-Karten (`ab`/`bis`) zuerst, an auffälligen Wettertagen (Nebel, Regen, Schnee, Gewitter, Hitze, Frost; höchstens alle 3 Tage) die Wetter-Story mit echten Werten von Open-Meteo und einer Zeile aus `storys.json` → `wetter`. Ist keine Karte mehr da, springt die Wetter-Story ein.
- **Abend (16 bis 23 Uhr):** Hinweis auf den Post von 16 Uhr: Setup des Posts (ohne Pointe) im Rahmen, Label „NEUER POST“, darunter eine Zeile aus `hinweise`. Erst wenn der Post gepostet ist.

Aufbau einer Karte in `storys.json` → `karten`: `{ "id", "inhalt", "bild"?, "ab"?, "bis"? }`. `inhalt` ist derselbe wie bei Posts (alle Formate aus `eintrag.mjs`), gerendert wird mit `render.mjs` in der Reel-Anordnung (Foto als Vollbild am Gesicht ausgerichtet, Karte in den sicheren Zonen). Ohne `bild` sucht `storyplan.mjs` eins aus: Hochformat-Szene, passt zur Jahreszeit, keine einmaligen Anlassbilder, nicht in den Posts der letzten 3 Tage und nicht in den Storys der letzten 10 Tage. Jede Karte geht nur einmal raus; `story-log.json` merkt sich, was gepostet wurde.

- Ton: Mit `JINGLE` = `an` (wie bei den Reels) wird jede Story ein kurzes Video (Standbild plus Jingle, mindestens 5 s), sonst ein stummes Bild.
- Wochentage: Nennt eine Karte einen Wochentag („Es ist Montag“), braucht sie `"tage": ["Montag"]` (oder `"alle"`, wenn der Tag nur allgemein gemeint ist); sie geht dann nur an diesen Tagen raus. `pruefen` lehnt Karten mit Wochentag ohne `tage` ab.
- Per API gibt es keine Sticker (Umfrage, Frage, Link, Musik, Ort). Umfrage und Fragen-Sticker sind nur Optik im Bild.
- Prüfen: `node storys.mjs pruefen` (Schema, Wortfilter, Bilder, doppelte IDs, Vorrat). Vorschau: `node storys.mjs vorschau <ordner> [datum] [karten-id …]`. Tests: `node --test autopilot/storyplan.test.mjs`.
- Weniger als 5 offene Karten: Issue mit Label `storys`. Nachschub schreibt der Sonntagslauf (`nachschub.md`).
- Einschalten: Repo-Variable `STORYS` = `an` (zusätzlich zu `POSTEN` = `an`). Ohne läuft alles im Probebetrieb: Das Bild hängt als Artefakt am Lauf, gepostet wird nichts. Probelauf per Hand: Actions → Storys → Run workflow (Slot, Datum, Karte wählbar).

## Wortfilter und Humor-Quote (seit 19.10.2026)

- **Wortfilter** (`wortfilter.mjs`): Kommen Leberkäse, Leberkas oder Semmel (auch 🥖) in Text, Namen, Caption, Aufforderung oder Hashtags vor, lehnt `holen.mjs` den Post ab (Kommentar plus Label `fehler`), `posten.mjs` prüft vor dem Posten noch einmal. Der Bildname zählt nicht, im Bild bleibt die Semmel als Easter Egg.
- **Humor-Quote** (`humorquote.mjs`): Feld `mechanik` im Post-JSON (Pflicht für neue Posts seit 22.10.2026, Liste und Höchstzahlen in `regeln.md`, Witz-Parameter), dazu `annahme` (Pflicht, die falsche Annahme des Lesers, Gag-Bauplan). Höchstens 2 gleiche Mechaniken hintereinander. Sonst wird der Post zurückgestellt und ein anderer kommt dran. Passt nichts anderes, geht er trotzdem raus und Dominik bekommt ein Issue mit Label `mechanik`. Anlass-Posts (`ab`/`bis`) werden nie zurückgestellt. Alte Posts ohne `mechanik` zählen nicht.
- **Zielgruppen** (`zielgruppe.mjs`): Feld `zielgruppe` (Lebenslage) und optional `region` (`dach`, `at`, `de`) im Post-JSON. Höchstzahl je Zielgruppe pro 14 Posts, höchstens 2 gleiche hintereinander, höchstens 2 pro Region `at`/`de`; zurückgestellt und gemeldet wie bei der Humor-Quote. Unter den passenden Posts wählt `holen.mjs` Anlass-Posts zuerst, dann die Zielgruppe mit dem meisten Bedarf, dann die Warteschlangen-Reihenfolge. `pruefen.mjs` verlangt `zielgruppe` bei neuen Posts und meldet Ü40-Signale (Mailverteiler, Wichteln …), die nur mit `ue40_ok` durchgehen. `node zielgruppe.mjs offen.json` zeigt die Verteilung der Warteschlange. Die Messung wertet zusätzlich nach Zielgruppe und Region aus.
- Tests: `node --test autopilot/*.test.mjs`

## Heartbeat (seit 19.10.2026)

`heartbeat.yml` läuft stündlich über den GitHub-Cron, unabhängig von cron-job.org. Ist ein Slot bei Beginn des nächsten noch nicht gepostet (07 um 11 Uhr, 11 um 16 Uhr, 16 um 22 Uhr, 22 um 23 Uhr Wien), legt `heartbeat.mjs` ein Issue „Slot … nicht gepostet“ (Label `ausfall`) an, mit dem letzten Autopilot-Lauf und der wahrscheinlichen Ursache (kein Lauf = cron-job.org prüfen). Es schließt sich, sobald der Slot nachgeholt ist. Nur bei `POSTEN` = `an`.

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
- `TIKTOK_POSTEN` = `an`: Reel zu TikTok. `TIKTOK_MODUS` = `entwurf` (Standard, landet in der TikTok-Inbox, Veröffentlichen per Fingertipp) oder `direkt` (sofort mit Text; bis TikTok die App geprüft hat nur als „Nur ich“). `TIKTOK_SICHTBARKEIT` z. B. `SELF_ONLY` zum Testen. Secrets `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REFRESH_TOKEN` (365 Tage gültig, neu holen über oidaleberkas.at/tiktok/; der Lauf legt 21 Tage vorher ein Issue an). Test: Actions → TikTok-Verbindungstest.
- `HANDLE`: Name im Post, Standard `resi.requiem`.
- `JINGLE` = `an`: Jingle ins Reel mischen. Braucht die Datei `autopilot/assets/jingle.mp3` (3 bis 5 s, höchstens 6 s). Fehlt die Datei, läuft das Reel ohne Jingle wie bisher. Standard ist das Ende: Das letzte Standbild steht, bis der Jingle durch ist. `JINGLE_POS` = `anfang` setzt ihn vor die Stimme.

## Kommentare (seit 20.10.2026)

`.github/workflows/kommentare.yml` läuft viermal am Tag und nach jedem Autopilot-Lauf und beantwortet neue Kommentare auf Instagram und YouTube automatisch aus dem festen Pool `antworten.json`. Keine Claude-API, kostet nichts.

- `kommentare.mjs` ordnet jeden Kommentar per Wortliste ein: `lachen`, `relatable`, `lob`, `herbert`, `flirt` (Resi blitzt ab), `kritik`, `markiert` (nur @Namen). Was in keine Kategorie passt und kurz ist, bekommt eine Allzweck-Antwort (`allgemein`). Echte Fragen und lange Kommentare bleiben unbeantwortet.
- Nie beantwortet, sondern im Issue mit Label `kommentare` gemeldet (Dominik zugewiesen): Links und Werbung, Hass, Sexuelles und Körper, Krise und Trauer, vermutlich Minderjährige, Fragen zu KI oder Echtheit, Politik und Religion. Hass und Sexuelles werden dort nicht zitiert.
- Grenzen: höchstens 10 Antworten am Tag, 3 pro Post, nur Kommentare der letzten 10 Tage. Jede Antwort höchstens alle 30 Tage und nie zweimal unter demselben Post. Ist eine Kategorie aufgebraucht, bleibt der Kommentar liegen.
- `kommentare-log.json` merkt sich beantwortete und gemeldete Kommentar-IDs (keine Namen).
- Neue Antworten: einfach in die passende Liste in `antworten.json` schreiben (Hochdeutsch, Deadpan, kurz). Tests: `node --test autopilot/kommentare.test.mjs`.
- Abschalten: Repo-Variable `KOMMENTARE_ANTWORTEN` = `aus`. Probelauf per Hand: Actions → Kommentare → Run workflow („Nur anzeigen“).
- Rechte: `instagram_manage_comments` und `youtube.force-ssl` (siehe `messung-anleitung.md`). Fehlt eins, wird die Plattform übersprungen.

## Bewertung

Jeder Post hängt als Kommentar an der Sammelliste (Label `sammelliste`). 👍 oder 👎 am Kommentar, oder ein eigener Kommentar, der mit `gut` oder `schlecht` beginnt. Claude liest das, bevor neue Posts geschrieben werden.

## Bilder

- `bilder/` ist die Bibliothek, `bibliothek.json` beschreibt jedes Bild in einer Zeile: `szene` für Bilder mit Hintergrund, `figur` für Reaktionsbilder auf Weiß (für das Format `antwort`), dazu `tags`, `gesicht` (`ja`, wenn Gesicht und Augen gut zu sehen sind; `bildwahl.mjs` schlägt diese Bilder zuerst vor) und bei Szenen im Hochformat `kopf` = [Gesichtsmitte x, Kinn y] als Anteil der Bildgröße (Bildausschnitt und Kartenlage im Reel). Der Reel-Ausschnitt bleibt möglichst mittig, damit Herbert & Co. drin bleiben; liegt etwas Wichtiges am Rand, setzt `mitte` (0 bis 1) die Bildmitte.

### Bild-Recycling (seit 19.10.2026)

Hintergrundbilder dürfen mit neuem Text wieder verwendet werden. Regeln in `bildregeln.mjs`, Tests in `bildregeln.test.mjs` (`node --test autopilot/bildregeln.test.mjs`).

- `tags`: `neutral`, Jahreszeit (`herbst`, `winter`) oder Anlass (`advent`, `weihnachten`, `silvester`, `halloween`, `allerheiligen`, `zeitumstellung`). Neue Tags mit Zeitraum in `bildregeln.mjs` eintragen.
- Anlassbilder kommen nur in ihrem Zeitraum und nur einmal. Jahreszeit-Bilder nur in ihrer Jahreszeit, dort recycelbar. Neutrale Bilder immer.
- Ungenutzte Bilder haben Vorrang. Erst wenn keins mehr passt, kommt ein schon verwendetes, frühestens nach 7 Tagen, das am längsten nicht verwendete zuerst. Nie dasselbe Bild am selben oder am Folgetag.
- Bei einer Wiederverwendung muss der Text neu sein: identischer Inhalt oder identische Caption wie bei einer früheren Nutzung des Bildes wird abgelehnt.
- `nutzung.json` ist der Nutzungsverlauf (Datum, Slot, Bild, Text, Fingerabdruck). `holen.mjs` prüft die Regeln für den gewählten Post und trägt ihn ein; verstößt er dagegen, bekommt das Issue einen Kommentar und das Label `fehler`.
- Bild wählen beim Schreiben: `node autopilot/bildwahl.mjs [JJJJ-MM-TT]` listet die passenden Bilder in Reihenfolge, `node autopilot/bildwahl.mjs --verlauf <datei>` zeigt die früheren Texte eines Bildes. Nicht zwei Posts mit demselben Bild gleichzeitig in die Warteschlange legen.
- Variablen: `BILD_RECYCLING` = `aus` schaltet das Recycling ab (nur ungenutzte Bilder, wie früher). `BILD_ABSTAND_TAGE` ändert den Mindestabstand (Standard 7).
