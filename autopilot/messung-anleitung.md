# Anleitung: Rechte für die Wochenauswertung

Die Wochenauswertung (`.github/workflows/messung.yml`, jeden Montag) braucht zwei Rechte, die die jetzigen Tokens nicht haben. Solange sie fehlen, läuft sie trotzdem und schreibt „übersprungen“ mit Grund in den Bericht. Tokens erzeugst nur du, nie in den Chat kopieren.

Beide Tokens werden in die **bestehenden** Secrets eingetragen. Der neue Token ersetzt den alten, Posten läuft damit weiter.

Secrets eintragen: [Settings → Secrets and variables → Actions](https://github.com/dominiksteizinger/oida-leberkas/settings/secrets/actions) → beim Secret auf den Stift → neuen Wert einfügen → **Update secret**.

---

## Teil A: Instagram (`instagram_manage_insights`)

Am besten zusammen mit dem Token-Tausch Mitte Dezember, dann ist es ein Handgriff statt zwei.

1. [Graph API Explorer](https://developers.facebook.com/tools/explorer/) öffnen und mit dem Facebook-Konto anmelden, das die Seite verwaltet.
2. Rechts oben unter **Meta App** die App wählen, mit der der bisherige Token erzeugt wurde.
3. Unter **User or Page** „User Token“ wählen.
4. Unter **Permissions** alle Rechte des alten Tokens behalten und **`instagram_manage_insights`** dazunehmen. Zum Posten nötig sind mindestens: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`, `business_management`; für Facebook zusätzlich `pages_manage_posts`. Welche der alte Token hat, zeigt der [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) (alten Token einfügen → „Scopes“).
5. **Generate Access Token** → im Fenster die Seite und das Instagram-Konto anhaken → bestätigen.
6. Der Token gilt nur etwa eine Stunde. In langlebig (60 Tage) tauschen: im [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/) einfügen → **Debug** → unten **Extend Access Token** → neuen Token kopieren.
7. Prüfen: Im Debugger muss unter „Scopes“ `instagram_manage_insights` stehen und „Expires“ etwa 60 Tage in der Zukunft liegen.
8. Als Secret **`INSTAGRAM_ACCESS_TOKEN`** eintragen (siehe oben).

Hinweis: Läuft die App im Entwicklungsmodus und du bist Admin der App, funktioniert das Recht meines Wissens ohne App-Prüfung durch Meta. Fragt Meta trotzdem nach „Advanced Access“ oder App Review, schick mir die Meldung (ohne Token).

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
