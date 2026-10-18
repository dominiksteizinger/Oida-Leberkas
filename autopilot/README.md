# Autopilot

Läuft jeden Tag um 16:00 UTC (17:00 Winterzeit) über `.github/workflows/autopilot.yml`, sobald alles auf main ist. Probeläufe per Hand: Actions → Autopilot → Run workflow.

1. `idee.mjs`: Claude Haiku 5.5 schreibt das Karussell nach `regeln.md`, Claude Sonnet 5.5 prüft es. Bis zu fünf Versuche, sonst wird nichts erzeugt.
2. `render.mjs`: rendert `tagebuch/<datum>/folie-1.jpg` und `folie-2.jpg` und trägt den Eintrag in `tagebuch/eintraege.json` ein (die Startseite zeigt die neuesten sechs).
3. `posten.mjs`: postet auf Instagram und, wenn `FACEBOOK_POSTEN=an`, auf der Facebook-Seite.
4. `youtube.mjs`: lädt das Reel als YouTube Short hoch, wenn `YOUTUBE_POSTEN=an` (mit KI-Kennzeichnung).

## Einstellungen (Settings → Secrets and variables → Actions → Variables)

- `POSTEN` = `an`: echter Betrieb. Ohne diese Variable läuft alles im Probebetrieb auf dem Branch `autopilot-probe` und es wird nichts gepostet.
- `FACEBOOK_POSTEN` = `an`: zusätzlich auf der Facebook-Seite posten (braucht den Seiten-Token mit `pages_manage_posts`).
- `YOUTUBE_POSTEN` = `an`: Reel als Short hochladen. Der Refresh-Token braucht den Bereich `youtube.upload`. `YOUTUBE_SICHTBARKEIT` = `private` oder `unlisted` zum Testen, sonst öffentlich.
- `MODELL_SCHREIBEN`, `MODELL_PRUEFEN`: Modelle überschreiben (Standard `claude-haiku-5-5` und `claude-sonnet-5-5`).

## Ideen einwerfen

Ein Issue mit dem Label `idee` anlegen, z. B. mit einem Instagram-Link und einem Satz dazu. Der Autopilot darf eine offene Idee aufgreifen und schließt das Issue, wenn er sie verwendet hat.

## Bilder

`bilder/` ist die Bibliothek, `bibliothek.json` beschreibt jedes Bild. Neue Bilder: Datei ablegen und eine Zeile in `bibliothek.json` ergänzen (`szene` für Bilder mit Hintergrund, `figur` für Bilder auf Weiß).
