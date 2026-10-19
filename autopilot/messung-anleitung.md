# Anleitung: Rechte für die Wochenauswertung

Die Wochenauswertung (`.github/workflows/messung.yml`, jeden Montag) braucht Rechte, die die alten Tokens nicht hatten (YouTube erledigt am 19.10.2026). Solange sie fehlen, läuft sie trotzdem und schreibt „übersprungen“ mit Grund in den Bericht. Tokens erzeugst nur du, nie in den Chat kopieren.

Beide Tokens werden in die **bestehenden** Secrets eingetragen. Der neue Token ersetzt den alten, Posten läuft damit weiter.

Secrets eintragen: [Settings → Secrets and variables → Actions](https://github.com/dominiksteizinger/oida-leberkas/settings/secrets/actions) → beim Secret auf den Stift → neuen Wert einfügen → **Update secret**.

---

## Teil A: Instagram (`instagram_manage_insights`, `instagram_manage_comments`)

Der neue Token ersetzt den alten in `INSTAGRAM_ACCESS_TOKEN`. Er muss alles können, was der alte konnte (Posten), plus Insights lesen und Kommentare verwalten. Dauer etwa 10 Minuten.

**1. Alten Token prüfen (welche Rechte hat er?)**
1. [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) öffnen.
2. Den alten Token einfügen. Du hast ihn nicht mehr im Klartext? Dann diesen Schritt überspringen und in Schritt 2 die Liste unten nehmen.
3. **Debug** klicken. Unter „Scopes“ stehen die Rechte. Notieren.

**2. Neuen Token erzeugen**
1. [Graph API Explorer](https://developers.facebook.com/tools/explorer/) öffnen, mit dem Facebook-Konto anmelden, das die Seite verwaltet.
2. Rechts oben bei **Meta App**: dieselbe App wie bisher wählen.
3. Bei **User or Page**: **User Token** (Nutzer-Token) wählen.
4. Bei **Permissions** → **Add a Permission**: diese Rechte anhaken (alle, auch wenn einige schon da sind):
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_insights` (neu, für die Auswertung)
   - `instagram_manage_comments` (neu, für Kommentare)
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts` (für Facebook-Posts)
   - `business_management`
   - plus alles, was in Schritt 1 sonst noch unter „Scopes“ stand
5. **Generate Access Token** klicken.
6. Im Facebook-Fenster: **Mit … fortfahren** → bei „Seiten“ die Seite anhaken, bei „Instagram-Konten“ **resi.requiem** anhaken → alle Schalter an lassen → **Speichern** → **OK**.
7. Oben im Feld „Access Token“ steht der neue Token. Er gilt nur etwa eine Stunde.

**3. In einen 60-Tage-Token tauschen**
1. Token kopieren und im [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) einfügen → **Debug**.
2. Ganz unten **Extend Access Token** klicken (eventuell Passwort bestätigen).
3. Unter dem Knopf erscheint der langlebige Token. Den kopieren.
4. Prüfen: den langlebigen Token noch einmal einfügen → **Debug**. Bei „Expires“ steht ein Datum in etwa 60 Tagen, bei „Scopes“ stehen `instagram_manage_insights` und `instagram_manage_comments`.

**4. Als Secret eintragen**
1. [Secrets](https://github.com/dominiksteizinger/oida-leberkas/settings/secrets/actions) öffnen → bei `INSTAGRAM_ACCESS_TOKEN` auf den Stift → langlebigen Token einfügen → **Update secret**.

**5. Testen**
1. [Actions → Instagram-Verbindungstest](https://github.com/dominiksteizinger/oida-leberkas/actions/workflows/instagram-verbindungstest.yml) → **Run workflow**. Muss grün werden (sonst kann der Autopilot nicht posten, dann alten Zustand melden).
2. [Actions → Wochenauswertung](https://github.com/dominiksteizinger/oida-leberkas/actions/workflows/messung.yml) → **Run workflow**. Im Issue „Wochenauswertung“ steht dann bei Instagram „ok“.
3. Mir Bescheid geben, dann prüfe ich die Zahlen.

Der Token läuft nach 60 Tagen ab. Der Autopilot meldet sich 14 Tage vorher per Issue, dann Schritte 2 bis 4 wiederholen.

Fragt Meta nach „Advanced Access“ oder App Review: Als Admin der App im Entwicklungsmodus sollte es meines Wissens ohne gehen. Kommt die Meldung trotzdem, schick mir den Text (ohne Token).

---

## Teil B: YouTube (`yt-analytics.readonly`)

1. In der [Google Cloud Console](https://console.cloud.google.com/) das Projekt wählen, zu dem die YouTube-Client-ID gehört.
2. [YouTube Analytics API](https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com) öffnen → **Aktivieren**. Die [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) ist schon aktiv (sonst ebenfalls aktivieren).
3. [Anmeldedaten](https://console.cloud.google.com/apis/credentials) → die OAuth-Client-ID öffnen → unter **Autorisierte Weiterleitungs-URIs** muss `https://developers.google.com/oauthplayground` stehen (wenn nicht: hinzufügen, speichern).
4. [OAuth-Zustimmungsbildschirm](https://console.cloud.google.com/apis/credentials/consent): Steht der Status auf „Test“, verfallen Refresh-Tokens nach 7 Tagen. Auf **In Produktion** stellen (für ein eigenes Konto reicht das, eine Prüfung ist dafür nicht nötig, Google zeigt beim Anmelden nur eine Warnung „nicht verifiziert“, die du mit „Weiter“ bestätigst).
5. [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) öffnen → Zahnrad rechts oben → **Use your own OAuth credentials** anhaken → Client-ID und Client-Secret eintragen (dieselben wie in den Secrets `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`).
6. Links unten bei **Input your own scopes** alle drei eintragen, mit Leerzeichen getrennt:
   ```
   https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly
   ```
   `youtube.upload` muss dabei sein, sonst bricht das Posten ab. `youtube.readonly` braucht die Auswertung für die Titel (damit sie Videos den Posts zuordnen kann).
7. **Authorize APIs** → mit dem Google-Konto des YouTube-Kanals anmelden → den Kanal wählen → alles erlauben.
8. **Step 2: Exchange authorization code for tokens** → den **Refresh token** kopieren.
9. Als Secret **`YOUTUBE_REFRESH_TOKEN`** eintragen (siehe oben).

---

## Testen

[Actions → Wochenauswertung → Run workflow](https://github.com/dominiksteizinger/oida-leberkas/actions/workflows/messung.yml). Im Issue „Wochenauswertung“ steht danach bei beiden Quellen „ok“. Steht „übersprungen“, nennt der Bericht den Grund.

Danach einmal [Actions → YouTube-Verbindungstest](https://github.com/dominiksteizinger/oida-leberkas/actions/workflows/youtube-verbindungstest.yml) laufen lassen, damit klar ist, dass das Posten mit dem neuen Token weiter geht.
