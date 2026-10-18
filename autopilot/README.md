# Autopilot

Läuft jeden Tag um 16:00 UTC (17:00 Winterzeit) über `.github/workflows/autopilot.yml`, sobald alles auf main ist. Probeläufe per Hand: Actions → Autopilot → Run workflow.

1. `idee.mjs`: Claude Haiku 5.5 schreibt das Karussell nach `regeln.md`, Claude Sonnet 5.5 prüft es. Bis zu fünf Versuche, sonst wird nichts erzeugt.
2. `bild.mjs` (an, sobald das Secret `GEMINI_API_KEY` gesetzt ist; abschalten mit `BILDER_GENERIEREN=aus`): Gemini zeichnet ein neues Bild für Folie 2 nach der Beschreibung aus `bild_neu`, mit Referenz-Sheet und fester Figurenbeschreibung. Claude Sonnet prüft es (gleiche Figur, keine KI-Fehler, kein Text, Grenze). Höchstens zwei Versuche, sonst bleibt das Bibliotheksbild. Gute Bilder wandern als `gen-<datum>` in die Bibliothek.
3. `render.mjs`: rendert `tagebuch/<datum>/folie-1.jpg` und `folie-2.jpg` und trägt den Eintrag in `tagebuch/eintraege.json` ein (die Startseite zeigt die neuesten sechs). Danach hängt der Lauf den Eintrag zur Bewertung an die Sammelliste.
4. `posten.mjs`: postet auf Instagram und, wenn `FACEBOOK_POSTEN=an`, auf der Facebook-Seite.
5. `youtube.mjs`: lädt das Reel als YouTube Short hoch, wenn `YOUTUBE_POSTEN=an` (mit KI-Kennzeichnung).

## Einstellungen (Settings → Secrets and variables → Actions → Variables)

- `POSTEN` = `an`: echter Betrieb. Ohne diese Variable läuft alles im Probebetrieb auf dem Branch `autopilot-probe` und es wird nichts gepostet.
- `FACEBOOK_POSTEN` = `an`: zusätzlich auf der Facebook-Seite posten (braucht den Seiten-Token mit `pages_manage_posts`).
- `YOUTUBE_POSTEN` = `an`: Reel als Short hochladen. Der Refresh-Token braucht den Bereich `youtube.upload`. `YOUTUBE_SICHTBARKEIT` = `private` oder `unlisted` zum Testen, sonst öffentlich.
- `BILDER_GENERIEREN` = `aus`: keine neuen Gemini-Bilder (Standard: an, sobald `GEMINI_API_KEY` gesetzt ist; ca. 3 Cent pro Bild). `MODELL_BILD` überschreibt das Modell (Standard `gemini-nano-banana-2.1`).
- `MODELL_SCHREIBEN`, `MODELL_PRUEFEN`: Modelle überschreiben (Standard `claude-haiku-5-5` und `claude-sonnet-5-5`).

## Ideen einwerfen

Neues Issue → Vorlage „Idee für den Autopilot“: Link und ein Satz, was daran gut ist. Der Autopilot kann Links nicht öffnen, er arbeitet nur mit der Beschreibung. Er greift eine offene Idee auf und schließt das Issue, sobald sie live verwendet wurde. Es zählen nur Issues von Dominik.

## Beispiele und Bewertung

- `beispiele.md`: gute und misslungene Karussells mit Begründung. Schreiben und Prüfung messen sich daran.
- Jeder Lauf hängt als Kommentar an die Sammelliste (Issue mit Label `sammelliste`). Urteil: 👍 oder 👎 direkt am Eintrag-Kommentar. Begründung: eigener Kommentar, der mit `gut` oder `schlecht` beginnt; er gilt für den Eintrag direkt darüber, mit Datum davor (`2026-10-19 schlecht, Pointe erklärt sich`) oder per „Zitieren“ für einen bestimmten. Ein Text-Urteil schlägt den Daumen.
- Ältere Einzel-Issues zählen weiter über die Labels `gut` und `schlecht`, Dominiks Kommentare dort sind die Begründung.
- `bewertungen.mjs` sammelt das vor jedem Lauf (nur Dominiks Reaktionen und Kommentare), gibt die letzten 15 je Urteil als zusätzliche Beispiele weiter und schreibt die Zählung (gut, schlecht, offen) in die Zusammenfassung des Laufs.

## Bilder

`bilder/` ist die Bibliothek, `bibliothek.json` beschreibt jedes Bild. Neue Bilder: Datei ablegen und eine Zeile in `bibliothek.json` ergänzen (`szene` für Bilder mit Hintergrund, `figur` für Bilder auf Weiß).
