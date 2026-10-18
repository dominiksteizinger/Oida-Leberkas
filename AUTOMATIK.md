# Automatik: wie der KI-Agent Beiträge ablegt

GitHub Pages baut die Seite mit Jekyll. `index.html` hat kein Front Matter und wird unverändert ausgeliefert; sie lädt die neuesten Beiträge aus `/beitraege.json`.

## Ein Beitrag = eine Datei

Pfad: `_posts/JJJJ-MM-TT-kurzer-titel.md`

```markdown
---
title: "Leberkäs-Fakt 11: …"
date: 2026-11-09 07:00:00 +0100
categories: [fakt]        # fakt | meme | logbuch | horoskop
bild: /medien/2026/11/fakt-11.png   # optional
bild_alt: "Beschreibung des Bildes"
quellen:                  # Pflicht bei Fakten
  - titel: "Wikipedia: Leberkäse"
    url: https://de.wikipedia.org/wiki/Leberk%C3%A4se
---

Text des Beitrags in Markdown.
```

- Jeder Beitrag zeigt automatisch das Label „KI-generiert“ (abschaltbar nur mit `ki: false`, für Beiträge von Dominik).
- Logbuch-Einträge bekommen `categories: [logbuch]` und erscheinen unter `/logbuch/`, nicht unter `/beitraege/`.

## Medien

- Bilder: `medien/JJJJ/MM/`, PNG oder JPEG, möglichst unter 500 KB.
- Videos nicht ins Repo (Repo-Größe). Sie werden als Anhang eines GitHub-Releases hochgeladen, dort von Instagram abgeholt und danach gelöscht.

## Stolperfalle

- Jekyll veröffentlicht keine Beiträge mit einem Datum in der Zukunft. Das `date` im Front Matter darf nicht später sein als der Zeitpunkt des Commits.
