# Nachschub: der wöchentliche Schreib-Lauf

Damit die Warteschlange nie leer wird und Aktuelles mitkommt, ohne dass Dominik etwas tun muss. Seit 20.10.2026.

## Wer macht was

| Wann | Was | Wer |
|---|---|---|
| Sonntag früh | `trends.yml` sammelt Google Trends AT und DE, Wikipedia (de, meistgelesen), Reddit (r/wien, r/Austria, r/de, r/FragReddit, r/arbeitsleben, r/Studium, r/ich_iel, r/teenagers, r/2meirl4meirl, r/me_irl, r/Showerthoughts; Feddit ich_iel als Ersatz), YouTube-Trends AT und Comedy DE, Mastodon-Hashtags, Schulferien Wien (60 Tage), kuriose Aktionstage, Anlässe der nächsten 21 Tage, harmlose ORF-Schlagzeilen und Kommentare unter unseren Posts ins Issue mit Label `trends` | GitHub Action, gratis |
| täglich 7 Uhr | Wetter, Anlässe, Schlagzeilen ins Issue `signale` (Autopilot) | GitHub Action |
| Sonntagabend | Schreib-Lauf nach dieser Anleitung: Posts schreiben, prüfen, Vorschau, Issues anlegen, Bericht im Projekt-Thread | geplante Claude-Aufgabe |
| bei Bedarf | Bilder in Gemini erzeugen und in den Projektordner `eingang/` legen | Dominik, das Einzige, was bei ihm bleibt |

Trend-Musik (Instagram/TikTok) gibt es nur in den Apps und lässt sich per API nicht an ein Reel hängen; wir nutzen eigene Stimme und Jingle. TikTok Creative Center geht nur über kostenpflichtige Scraper, deshalb nicht dabei.

## Ablauf des Schreib-Laufs

1. **Repo aktuell:** `git fetch origin main && git checkout -B <arbeitsbranch> origin/main`, `cd autopilot && npm ci`.
2. **Eingang:** Neue Bilder in `/mnt/project-files/eingang/` (oder lose `Gemini_Generated_Image_*` im Projektordner, die noch nicht in `figur/bibliothek/` sind): ansehen, auf 1080x1920 zuschneiden (Hochformat, sonst wie es ist), mit sprechendem Namen nach `autopilot/bilder/` und `figur/bibliothek/`, Eintrag in `bibliothek.json` (`art`, `tags`, `gesicht`, `kopf`, `beschreibung`). Per PR mergen (Freigabe siehe Memory „merge-freigabe“).
3. **Lage lesen:**
   - Letzter Kommentar im Issue `trends`. Ist er älter als 2 Tage, `trends.yml` per workflow_dispatch starten und warten.
   - Letzte Kommentare im Issue `signale`.
   - Offene Warteschlange: alle offenen Issues mit Label `warteschlange` (Nummer und Body) als JSON nach `offen.json` speichern. Reichweite = Anzahl / 2 Tage.
   - Neueste Auswertung `auswertung/<datum>.md` (Messung, montags): Posts mit den meisten Saves und Shares bekommen eine neue Folge mit neuer Wendung, schwache Formate seltener.
   - Kommentare unter unseren Posts (im Trends-Kommentar): Fragen und Sprüche des Publikums werden zu Antwort-Karten (`antwort`, `von` erfunden, nie den echten Namen), nur wenn sie harmlos sind und den Send-Test bestehen.
   - Daumen in der Sammelliste (Bewertungen), `tagebuch/eintraege.json` (zuletzt gepostet, nichts wiederholen), `/mnt/project-files/ideen/ideen.md` (Ideen mit Status **frei** zuerst verwenden und dort auf „in Warteschlange #NR“ setzen).
4. **Menge:** Die Warteschlange soll drei bis vier Wochen reichen (42 bis 56 offene Posts, zwei pro Tag). Neu schreiben: `56 − offen`, mindestens 4 (die Trend- und Anlass-Posts), höchstens 24. Fehlen danach Anlässe der nächsten fünf Wochen (Advent, Nikolo, Weihnachten, Silvester …), dafür Anlass-Posts mit `ab`/`bis` dazu.
5. **Trend-Übersetzung (2 bis 4 Posts):** Aus `trends` nur Themen nehmen, die viele kennen und die harmlos sind (Wetter, Zeitumstellung, Feiertag, Ferien, ein viel gesuchtes Alltagsthema, ein Format, das gerade überall läuft). Daraus eine Situation aus Resis Alltag machen; der Trend ist Anlass, nicht Inhalt.
   - Nie: Namen realer Personen, Marken, Sender, Sendungen, Vereine, Spiele, Filme; Politik, Unglücke, Kriminalität, Krankheit, Sport-Ergebnisse. Keine fremden Memes, Sounds oder Texte nachbauen, nur das Format mit der eigenen Figur.
   - Jeder Trend-Post bekommt `"bis"` (Datum, bis zu dem das Thema noch frisch ist, meist heute + 7 Tage) und `"trend": "<Quelle>: <Begriff>"`. Posts mit `bis` kommen in der Warteschlange vor allen anderen dran (`reihenfolge.mjs`).
   - Teenie- und Relatable-Quellen (r/ich_iel, r/teenagers, r/2meirl4meirl, r/me_irl, r/Showerthoughts, r/FragReddit, r/Studium, r/arbeitsleben) liefern nur das Thema oder Gefühl (Schule, Prüfungen, erster Job, Montag, Gruppenchat). Nie Text, Witz oder Bild übernehmen, englische Posts nie übersetzen; Resi erlebt es selbst, auf Hochdeutsch.
   - Schulferien und kuriose Aktionstage sind Anlässe: Post mit `ab`/`bis` auf den Zeitraum legen.
   - Findet sich nichts Taugliches, keinen Trend-Post erzwingen.
6. **Schreiben:** nach `regeln.md`, `beispiele.md` und `wissen/pointen-check.md`. Mix wie in `regeln.md` (10 bis 12 Alltag von 14, Abblitz-Muster mit `"mechanik": "absage"`, höchstens 3 davon pro 14). Jeder Post besteht Send-Test und 3-Sekunden-Test, Punkteskala mindestens 14 von 20. Hochdeutsch, Leberkäse und Semmel nie im Text.
7. **Bilder:** `node bildwahl.mjs <datum>` für den Tag, an dem der Post etwa drankommt (heute + Reichweite). Ein Bild pro Post, nicht doppelt in der Warteschlange; bei Wiederverwendung neuer Text (`--verlauf`).
8. **Prüfen:** Posts als Liste nach `neu.json` (je Post `titel` wie „Post 69 (szene): …“, fortlaufend nach der höchsten Nummer, optional `notiz` als Satz über dem JSON-Block), dann `node pruefen.mjs neu.json --warteschlange offen.json --issues issues.json`. Erst wenn alles ✓ ist, weiter.
9. **Vorschau:** `node vorschau.mjs neu.json /mnt/project-files/warteschlange-<datum>/`. Jede Vorschau ansehen; was im Bild nicht funktioniert (Text zu lang, Pointe verdeckt), umschreiben und zurück zu 8.
10. **Anlegen:** Für jeden Eintrag in `issues.json` ein Issue mit Label `warteschlange` anlegen (GitHub-MCP `issue_write`, damit ist Dominik der Autor; `holen.mjs` nimmt nur Issues vom Repo-Owner).
11. **Bilder-Nachschub (Gemini-API, Dominik 20.10.2026: höchstens 15 Bilder im Monat):** Fehlen Bilder (siehe unten), Szenen als `autopilot/bild-auftraege/<datum>.json` anlegen (`[{ "datei", "szene" }]`, Szene englisch, eine Handlung, Herbert nah bei ihr), mergen, Workflow `bild-probe.yml` mit `auftraege: bild-auftraege/<datum>.json` starten, Branch `bild-probe` holen und jedes Bild ansehen: Resi wie im Referenz-Sheet, Herbert wie `referenz/herbert.jpg` (keine Katze), normale Perspektive, kein Rahmen, keine Schrift. Taugliche Bilder auf 1080x1920 bringen, nach `autopilot/bilder/` und `figur/bibliothek/`, in `bibliothek.json` mit Tags, `gesicht`, `kopf` eintragen. Ausschuss verwerfen. Der Deckel steht in `bildgen.mjs` (`bild-log.json`).
    Alter Weg, wenn der Deckel erreicht ist: Reichen die passenden Bilder für die nächsten drei Wochen nicht (weniger als 14 bei `node vorrat.mjs <heute + 14>`), oder kommen Anlässe ohne passendes Bild, eine Prompt-Datei `/mnt/project-files/figur/prompts-<datum>.md` im Aufbau von `figur/prompts-7.md` schreiben (Startnachricht mit Figurbeschreibung, 9:16, nummerierte Szenen mit Dateinamen) und im Bericht nennen.
12. **Bericht** im Projekt-Thread, kurz: wie viele Posts neu, wie weit die Warteschlange jetzt reicht, welche Trends übersetzt wurden, Vorschau-Bilder angehängt, ob Dominik Bilder machen muss (mit Link zur Prompt-Datei). Sonst nichts von ihm verlangen.
