# 🔐 Google Calendar OAuth Setup Anleitung

## Übersicht
Diese Anleitung führt dich durch die Einrichtung von Google OAuth 2.0 für FireWoodFlow.

**Dauer:** ~15 Minuten  
**Kosten:** €0 (kostenloses Google Cloud Konto reicht!)

---

## 📝 Schritt-für-Schritt

### **Schritt 1: Google Cloud Console öffnen**

1. Gehe zu: https://console.cloud.google.com/
2. Melde dich mit deinem Google-Konto an
3. Wenn du kein Google Cloud Projekt hast: Klicke auf "Projekt auswählen" → "NEUES PROJEKT"

---

### **Schritt 2: Neues Projekt erstellen**

1. **Projektname:** `FireWoodFlow` (oder was du möchtest)
2. **Standort:** Belassen oder auswählen
3. Klick auf **"ERSTELLEN"**
4. Warte bis das Projekt erstellt wurde (ca. 10-20 Sekunden)
5. Stelle sicher dass das Projekt oben links ausgewählt ist

---

### **Schritt 3: Google Calendar API aktivieren**

1. Links im Menü: **"APIs & Dienste"** → **"Bibliothek"**
2. Oben suchen nach: `Google Calendar API`
3. Klick auf **"Google Calendar API"** in den Suchergebnissen
4. Klick auf **"AKTIVIEREN"** Button
5. Warte bis "API aktiviert" angezeigt wird

---

### **Schritt 4: OAuth Consent Screen einrichten**

1. Links: **"APIs & Dienste"** → **"OAuth-Zustimmungsbildschirm"**
2. **Nutzertyp auswählen:** 
   - ⚪ **Extern** (für alle Nutzer) ODER
   - 🔵 **Intern** (nur für deine Organisation - geht nur mit Google Workspace)
   - **Wähle: EXTERN** (das ist kostenlos)
3. Klick auf **"ERSTELLEN"**

#### **App-Informationen ausfüllen:**

| Feld | Wert |
|------|------|
| **App-Name** | `FireWoodFlow` |
| **Nutzer-Support-E-Mail** | Deine E-Mail (brennholzjohannsen@gmail.com) |
| **Entwickler-Kontaktinformationen** | Deine E-Mail |

4. Klick auf **"SPEICHERN UND WEITER"**

#### **App-Bereiche (Scopes):**

1. Klick auf **"BEREICHE HINZUFÜGEN ODER ENTFERNEN"**
2. Suche und füge diese 3 Bereiche hinzu:
   ```
   .../auth/calendar.events.insert
   .../auth/calendar.events.readonly
   .../auth/calendar.calendars.readonly
   ```
3. Klick auf **"AKTUALISIEREN"** unten
4. Klick auf **"SPEICHERN UND WEITER"**

#### **Testnutzer hinzufügen:**

1. Bei "Testnutzer" auf **"NUTZER HINZUFÜGEN"** klicken
2. Deine E-Mail eingeben: `brennholzjohannsen@gmail.com`
3. Klick auf **"HINZUFÜGEN"**
4. Klick auf **"SPEICHERN UND WEITER"**
5. Klick auf **"ZURÜCK ZUM DASHBOARD"**

---

### **Schritt 5: OAuth Credentials erstellen**

1. Links: **"APIs & Dienste"** → **"Anmeldedaten"**
2. Oben: **"ANMELDEDATEN ERSTELLEN"** → **"OAuth-Client-ID"**

#### **Anwendungstyp auswählen:**

1. **Anwendungstyp:** `Webanwendung`
2. **Name:** `FireWoodFlow Web Client`

#### **Autorisierte JavaScript-Ursprünge:**

Klick auf **"URSPRUNG HINZUFÜGEN"** und füge deine Domain hinzu:

**Für Testing (lokale Entwicklung):**
```
http://localhost:8000
http://localhost:3000
http://127.0.0.1:5500
```

**Für Production (GitHub Pages):**
```
https://brennholzjohannsen.github.io
https://firewoodflow.de (wenn du eigene Domain hast)
```

#### **Autorisierte Weiterleitungs-URIs:**

Klick auf **"URI HINZUFÜGEN"** für den Callback:

**Für Testing:**
```
http://localhost:8000/oauth-callback.html
http://localhost:3000/oauth-callback.html
```

**Für Production:**
```
https://brennholzjohannsen.github.io/FireWoodFlow/app/oauth-callback.html
https://firewoodflow.de/app/oauth-callback.html
```

3. Klick auf **"ERSTELLEN"**

---

### **Schritt 6: Client ID und Secret notieren**

Ein Popup zeigt deine Credentials:

```
┌─────────────────────────────────────────┐
│ OAuth-Client wurde erstellt             │
├─────────────────────────────────────────┤
│                                         │
│ Client-ID:                              │
│ 123456789-abc123def456...apps.googleusercontent.com │
│                                         │
│ Client-Geheimnis:                       │
│ GOCSPX-xyz789abc123...                  │
│                                         │
│ [OK] [HERUNTERLADEN]                    │
└─────────────────────────────────────────┘
```

**WICHTIG:**
- ✅ **Client-ID** kopieren und speichern
- ✅ **Client-Secret** kopieren und speichern (kann nicht wieder angezeigt werden!)
- 🔒 **NIEMALS** das Client-Secret im Frontend-Code veröffentlichen!

---

### **Schritt 7: App veröffentlichen (optional aber empfohlen)**

Damit deine App nicht nur im Testmodus läuft:

1. Zurück zu **"OAuth-Zustimmungsbildschirm"**
2. Oben rechts bei "Veröffentlichungsstatus":
   - Von **"Test"** auf **"Veröffentlichung"** umschalten
3. Bestätigen mit **"BESTÄTIGEN"**

⚠️ **Hinweis:** Bei "Extern" muss deine App dann von Google verifiziert werden (kann Tage dauern). Für den persönlichen Gebrauch reicht der **Testmodus** völlig aus!

---

## 🔧 Nächste Schritte

Nachdem du das Google Cloud Setup abgeschlossen hast:

1. **Client-ID** und **Client-Secret** bereithalten
2. Mir Bescheid geben dass du fertig bist
3. Ich implementiere den OAuth Flow im Code
4. Wir testen die Verbindung

---

## 📱 Hilfreiche Links

- **Google Cloud Console:** https://console.cloud.google.com/
- **Deine Credentials verwalten:** https://console.cloud.google.com/apis/credentials
- **Calendar API Docs:** https://developers.google.com/calendar/api/guides/overview
- **OAuth 2.0 Guide:** https://developers.google.com/identity/protocols/oauth2

---

## ❓ Häufige Fragen

### **Q: Kostet das was?**
A: Nein! Google Cloud Projekte sind kostenlos, und die Calendar API hat ein sehr großzügiges Free-Tier (100.000 Requests/Tag zum Schreiben).

### **Q: Muss ich meine App verifizieren lassen?**
A: Für den persönlichen Gebrauch nein. Solange du im Testmodus bleibst und nur deine eigene E-Mail als Testnutzer eingetragen ist, funktioniert alles ohne Verifizierung.

### **Q: Was wenn ich mehrere Nutzer habe?**
A: Dann musst du die App veröffentlichen lassen. Das dauert ein paar Tage bis Google sie prüft.

### **Q: Kann ich das später ändern?**
A: Ja! Du kannst jederzeit weitere Testnutzer hinzufügen oder die App veröffentlichen.

---

## 🎯 Checkliste

- [ ] Google Cloud Projekt erstellt
- [ ] Google Calendar API aktiviert
- [ ] OAuth Consent Screen eingerichtet
- [ ] Scopes hinzugefügt (calendar.events.insert, etc.)
- [ ] Testnutzer (deine E-Mail) hinzugefügt
- [ ] OAuth Client-ID erstellt
- [ ] Client-ID notiert
- [ ] Client-Secret notiert
- [ ] Autorisierte URIs für deine Domain eingetragen

---

**Wenn du fertig bist, sag mir Bescheid und ich implementiere den Rest!** 🚀
