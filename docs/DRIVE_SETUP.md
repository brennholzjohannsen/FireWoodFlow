# ☁️ Google Drive Sync Setup (Drive Edition)

Die **Drive Edition** von FireWoodFlow speichert alle Daten **lokal auf dem Gerät** (kein Login, kein Supabase) und synchronisiert sie optional in **deinen eigenen Google Drive** — in einen Ordner namens `FireWoodFlow`. Die App sieht dabei **nur ihre eigene Datendatei** (Scope `drive.file`), nicht den Rest deines Drives.

## Einrichtung (einmalig, ~10 Minuten)

### 1. Google Cloud Projekt anlegen

1. Öffne https://console.cloud.google.com/
2. Oben links: **Projekt auswählen → NEUES PROJEKT**
3. Name: `FireWoodFlow` → **ERSTELLEN**

### 2. Google Drive API aktivieren

1. Links: **APIs & Dienste → Bibliothek**
2. Suche: `Google Drive API`
3. Antippen → **AKTIVIEREN**

### 3. OAuth-Zustimmungsbildschirm

1. Links: **APIs & Dienste → OAuth-Zustimmungsbildschirm**
2. Nutzertyp: **Extern** → **ERSTELLEN**
3. App-Name: `FireWoodFlow`, Support-E-Mail: deine E-Mail → **SPEICHERN UND WEITER**
4. **Bereiche (Scopes):** Du kannst hier nichts eintragen und trotzdem fortfahren (die App fordert `drive.file` dynamisch an). → **SPEICHERN UND WEITER**
5. **Testnutzer:** Deine eigene Gmail-Adresse hinzufügen → **HINZUFÜGEN** → **SPEICHERN UND WEITER**
6. Bleibe im **Testmodus** (reicht für Privatnutzung, keine Google-Verifizierung nötig). Hinweis: Im Testmodus laufen Zugriffe 7 Tage lang — bei Ablauf einfach neu verbinden (die App fragt dann einmal kurz).

### 4. OAuth Client-ID erstellen

1. Links: **Anmeldedaten → ANMELDEDATEN ERSTELLEN → OAuth-Client-ID**
2. Anwendungstyp: **Webanwendung**
3. Name: `FireWoodFlow Web`
4. **Autorisierte JavaScript-Ursprünge:**
   ```
   https://brennholzjohannsen.github.io
   http://localhost:8000
   ```
   (bei eigener Domain zusätzlich `https://firewoodflow.de`)
5. **Autorisierte Weiterleitungs-URIs:** keine nötig (Token-Flow läuft ohne Redirect)
6. **ERSTELLEN** → die **Client-ID** (`xxxx.apps.googleusercontent.com`) kopieren. Das Client-Secret wird NICHT benötigt.

### 5. In der App eintragen

1. Drive Edition öffnen: `https://brennholzjohannsen.github.io/FireWoodFlow/app-drive/dashboard.html`
2. **Einstellungen → ☁️ Google Drive Sync**
3. Client-ID einfügen → **Client-ID speichern**
4. **🔗 Mit Google Drive verbinden** → Google-Fenster zustimmen
5. Fertig — der erste Sync läuft automatisch, danach wird bei jeder Änderung (ca. 3 s nach der letzten) hochgeladen.

## Installation auf dem iPhone (PWA)

1. Drive Edition in Safari öffnen
2. **Teilen → „Zum Home-Bildschirm"**
3. Ab jetzt startet die App wie eine native App — kein Login.

## Wie der Sync funktioniert

| Zeitpunkt | Was passiert |
|---|---|
| App-Start | App vergleicht lokalen Zeitstempel mit der Drive-Datei. Cloud neuer → Cloud-Daten laden (vorher automatisches lokales Backup). Lokal neuer → hochladen. |
| Jede Änderung | 3 Sekunden nach der letzten Änderung wird der lokale Stand nach Drive hochgeladen (Entprellung). |
| Konflikt | Der **neuere Stand gewinnt** (Zeitstempel). Vor dem Überschreiben wird immer ein Backup im localStorage angelegt (die letzten 3 Versionen bleiben erhalten). |
| Token | Google-OAuth-Tokens laufen nach ~1 Stunde ab. Die App holt sie still neu, solange du bei Google eingeloggt bist. Geht das nicht: Einstellungen → „Jetzt synchronisieren" drücken. |

## Datendatei in deinem Drive

Die Datei liegt unter `Mein Drive/FireWoodFlow/firewoodflow-data.json` und enthält alle Produkte, Kunden, Bestellungen, Ausgaben und Einstellungen als JSON. Du kannst sie:
- **sehen/herunterladen** (z. B. als manuelles Backup),
- **löschen** (die App legt beim nächsten Sync eine neue an — lokale Daten bleiben davon unberührt).

## Import von Daten aus der Supabase-Version

Beide Versionen nutzen dasselbe Datenformat. Wenn in der Supabase-Version Daten nur in Supabase (nicht lokal) liegen, exportiere sie dort einmalig über die Browser-Konsole (F12):

```js
// In der Supabase-Version ausführen und Ausgabe speichern:
copy(JSON.stringify({
  firewoodflow_products: localStorage.getItem('firewoodflow_products'),
  firewoodflow_customers: localStorage.getItem('firewoodflow_customers'),
  firewoodflow_orders: localStorage.getItem('firewoodflow_orders'),
  firewoodflow_expenses: localStorage.getItem('firewoodflow_expenses'),
  firewoodflow_company: localStorage.getItem('firewoodflow_company'),
  firewoodflow_company_settings: localStorage.getItem('firewoodflow_company_settings'),
  firewoodflow_inventory_settings: localStorage.getItem('firewoodflow_inventory_settings')
}))
```

Diese JSON-Objekt (ein Objekt mit 7 Keys) kannst du in der Drive-Edition unter Einstellungen → Gelegenheit importieren — oder direkt: In der Drive-Edition Konsole öffnen und die Werte mit `localStorage.setItem('firewoodflow_products', '...')` einspielen, dann Seite neu laden und einmal „Jetzt synchronisieren" drücken.

## Fehlerbehebung

- **„Google-Anmeldung erforderlich"**: Token abgelaufen → einmal „Jetzt synchronisieren" drücken (öffnet evtl. ein Google-Fenster).
- **403-Fehler bei `about`/Dateiliste**: Im Google-Cloud-Bereich „OAuth-Zustimmungsbildschirm" bist du nicht als Testnutzer eingetragen, oder die Drive API ist nicht aktiviert.
- **`origin_mismatch`**: Die GitHub-Pages-Origin fehlt bei den JavaScript-Ursprüngen des OAuth-Clients.
- **Sync hängt**: Einstellungen → „Verbindung trennen" und neu verbinden.
