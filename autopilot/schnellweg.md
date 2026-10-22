# Trend-Schnellweg: Aktuelles innerhalb von Stunden

Seit 20.10.2026 (Dominik: Trends mit Meme-Potenzial nicht erst am Sonntag). Ergänzt den Wochen-Lauf (`nachschub.md`), ersetzt ihn nicht.

## Wer macht was

| Wann (Wien) | Was | Wer |
|---|---|---|
| ca. 5 und 14 Uhr | `trends.yml` im Modus `schnell`: Google Trends DE und AT (mit Schlagzeile), Wikipedia de gestern, Reddit Top des Tages (r/de, r/Austria, r/wien, r/FragReddit), YouTube-Trends DE und AT, ORF, Anlässe der nächsten 3 Tage ans Issue mit Label `trends-schnell` | GitHub Action, gratis |
| 6:35 und 15:35 | Schnellweg-Lauf nach dieser Anleitung, höchstens ein Trend-Post pro Tag | geplante Claude-Aufgabe |
| 7:17, 11:17, 16:17 und 22:17 | Der Post kommt im nächsten Slot dran (`bis` = morgen, `reihenfolge.mjs` zieht ihn vor) | Autopilot |

Der Claude-Container erreicht die Trend-Quellen nicht (Proxy 403), deshalb sammelt nur die Action.

## Ablauf

1. **Schon erledigt?** Gibt es heute (Wien) schon ein Issue mit Label `schnellweg` (offen oder zu), ist der Lauf fertig: keine Antwort, nichts schreiben.
2. **Trends frisch?** Letzten Kommentar im Issue `trends-schnell` lesen (GitHub-MCP). Fehlt er oder ist er älter als 3 Stunden: `trends.yml` per workflow_dispatch mit `modus: schnell` auf `main` starten, Lauf abwarten (etwa 2 bis 3 Minuten, Status über GitHub-MCP `actions_list`), dann den neuen Kommentar lesen. Scheitert das, den letzten vorhandenen nehmen; ist der älter als 24 Stunden, Lauf beenden.
3. **Was ist neu?** Mit dem vorletzten Kommentar vergleichen: Interessant ist, was neu auftaucht oder in mehreren Quellen gleichzeitig steht (Google DE und AT, Wikipedia, Reddit). Ein Thema, das schon in der offenen Warteschlange steckt (Feld `trend` in den offenen Issues mit Label `warteschlange`) oder in `tagebuch/eintraege.json` der letzten 14 Tage, zählt nicht.
4. **Bewerten, streng.** Ein Thema kommt nur durch, wenn alles stimmt:
   - Die Zielgruppe (18 bis 28, Deutschland 37 %, Österreich 25 %) kennt es heute ohne Erklärung, und es funktioniert in Deutschland genauso wie in Österreich.
   - Harmlos: Wetter, Zeitumstellung, Feiertag, Ferien, Alltagsthema, ein Format oder Gefühl, das gerade überall läuft, ein viel gesuchter Aktionstag.
   - Daraus wird eine Szene aus Resis Alltag, die den Send-Test („das schicke ich meiner Freundin“) und den 3-Sekunden-Test besteht und mindestens 15 von 20 Punkten der Skala in `wissen/pointen-check.md` holt (eine mehr als im Wochen-Lauf, weil niemand mehr drüberschaut).
   - **Harte Sperren, ohne Ausnahme:** Politik, Wahlen, Krieg, Unglücke, Unfälle, Kriminalität, Krankheit, Tod realer Menschen, Hass, reale Personen (auch nicht angedeutet), Marken, Produkte, Sender, Sendungen, Spiele, Filme, Vereine, Sport-Ergebnisse, fremde Memes, Sounds oder Texte. Der Trend ist Anlass, nie Inhalt.
   - **Heikel** (kann kippen, Tragödie im Hintergrund, Streitthema, unklar ob harmlos): nicht schreiben, nur im Bericht melden (Schritt 8).
   - Findet sich nichts, das klar besteht: kein Post. Lieber kein Trend-Post als ein mittelmäßiger.
5. **Schreiben:** Vorher `auswertung/signal.json` lesen: Mechaniken unter `weniger` meiden, Schlüsse aus `flop` nicht nachbauen, die Prüffragen unter `gruende` (häufigste Fehlerarten) an den Post halten. Passt der Trend zu einem Format aus `trend-formate.md`, dieses nehmen. Dann genau ein Post nach `regeln.md`, `beispiele.md` und `wissen/pointen-check.md`, Hochdeutsch, Leberkäse und Semmel nie im Text. Felder zusätzlich: `"zielgruppe"`, `"mechanik"` und `"annahme"` (Gag-Bauplan in `regeln.md`) (siehe `regeln.md`, Witz-Parameter; Flach-Test gilt, ein Trend als reines Stimmungsbild fällt durch; wenn möglich Beziehung oder Selbstironie), `"bis"` = morgen (Wien), `"trend": "<Quelle>: <Begriff>"`. Titel „Post <nächste Nummer> (<format>): …“, `notiz` „Schnellweg <datum>: <Trend>“.
6. **Bild und Prüfung:** Repo auf `origin/main`, `cd autopilot && npm ci`. Bild mit `node bildwahl.mjs <heute>`, offene Warteschlange nach `offen.json`, dann `node pruefen.mjs neu.json --warteschlange offen.json --issues issues.json`. Erst wenn alles ✓ ist: `node vorschau.mjs neu.json /mnt/project-files/schnellweg-<datum>/` und die Vorschau ansehen. Passt Text oder Bild nicht, umschreiben oder verwerfen. Dann der blinde Gegenleser nach `gegenleser.md`; fällt der Post dort durch, wird er nicht angelegt.
7. **Anlegen:** Issue per GitHub-MCP `issue_write` mit Labels `warteschlange` und `schnellweg` (damit ist Dominik der Autor; `holen.mjs` nimmt nur Issues vom Repo-Owner). Kein PR nötig.
8. **Bericht** im Projekt-Thread nur, wenn ein Post angelegt wurde oder ein heikles Thema gemeldet werden muss: ein bis zwei Sätze (Trend, Issue-Link, in welchem Slot er etwa kommt), Vorschau-Bild anhängen. Ohne Post und ohne Meldung: keine Nachricht.
