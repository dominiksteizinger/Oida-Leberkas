# Blinder Gegenleser (seit 22.10.2026)

Dominik, 22.10.2026: ja. Gegen flache Pointen, Vorwissen und Ü40-Ton reicht die Prüfung durch den Schreibenden nicht, weil der die Pointe schon kennt. Der Gegenleser kennt nichts außer dem fertigen Bild.

## Ablauf (nach der Vorschau, vor dem Anlegen)

1. Einen **neuen** Agenten starten (Agent-Tool, `subagent_type: "general-purpose"`, kein Fork, damit er nichts aus dem Lauf kennt). Er bekommt nur die Pfade der Vorschaubilder (`/mnt/project-files/warteschlange-<datum>/NN.jpg`) und den Auftrag unten, keine Post-JSONs, keine Annahme, keine Mechanik. Ein Agent für alle Bilder eines Laufs reicht.
2. Seine Antworten mit dem Post vergleichen:
   - **Verworfen oder umschreiben**, wenn er die Pointe anders versteht als `annahme` und Schluss meinen, wenn er Vorwissen braucht, wenn er niemanden zum Schicken nennt, wenn er die Person auf über 30 schätzt oder wenn die Note unter 3 liegt.
   - **Grund festhalten:** Jeder umgeschriebene oder verworfene Post bekommt genau eine Fehlerart aus `fehlerarten.mjs` (seine Zeile 6, sonst selbst zuordnen) und wird eingetragen: `node fehlerarten.mjs add <datum> gegenleser "<Titel>" <fehlerart> "<ein Satz, woran es lag>" "<Schluss>"`. Die Datei `auswertung/gruende.json` geht mit dem PR des Laufs nach main.
   - Umgeschriebene Posts laufen erneut durch `pruefen.mjs`, die Vorschau und einen neuen Gegenleser (nicht denselben).
3. Im Bericht eine Zeile: wie viele Posts geprüft, wie viele umgeschrieben oder verworfen.

Kosten: nur Claude-Laufzeit, keine API.

## Auftrag an den Gegenleser (wörtlich übergeben)

> Du bist eine 22-jährige Frau aus Deutschland, scrollst abends durch Instagram und kennst den Account nicht. Sieh dir jedes Bild einzeln an (Read-Tool auf den Pfad) und antworte pro Bild in genau diesen fünf Zeilen, ohne Einleitung:
> 1. Worüber lacht man? (ein Satz; „weiß nicht“ ist erlaubt)
> 2. An wen schickst du das, und was schreibst du dazu? („niemand“ ist erlaubt)
> 3. Wie alt ist die Person, die das typischerweise teilt? (Zahl)
> 4. Brauchst du Vorwissen, um es zu verstehen? (nein / ja: welches)
> 5. Note 1 bis 5 (5 = sofort weitergeschickt)
> 6. Wenn die Note unter 4 liegt: Woran liegt es? Genau eins von: vorwissen (Vorwissen nötig), logische_folge (Schluss folgt nur aus dem Setup), vorhersehbar (Schluss erratbar), flach (nur Zustand oder Stimmung), kontext_unklar (unklar, wer mit wem worüber), kein_adressat (niemand zum Schicken), ue40 (klingt nach Ü40), pointe_falsch (Pointe beim Gegenüber, als Frage oder laut), zu_lang, bild_passt_nicht. Dazu ein Satz.
> Sei streng. Höflichkeit hilft hier niemandem.

## Schnellweg

Gleich, nur ein Bild. Besteht der Trend-Post nicht, wird er nicht angelegt.
