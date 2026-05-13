# FireWoodFlow 🔥

**Die Web-App für Brennholzhändler**

Eine mobile-first Progressive Web App (PWA) zur Verwaltung von Inventar, Kunden und Aufträgen für Brennholzhandel.

## ✨ Features

### Phase 1: Authentifizierung ✓
- [x] Login/Registrierung mit Email & Passwort
- [x] Session-Management
- [x] Passwortschutz für alle Bereiche

### Phase 2: Inventar-Verwaltung (in Arbeit)
- [ ] Produkte anlegen (Holzsorte, Scheitlänge, Trocknungsgrad, Preis)
- [ ] Lagerbestand verwalten
- [ ] Suchen & Filtern
- [ ] Lagerwert-Berechnung

### Phase 3: Kundendatenbank (geplant)
- [ ] Kundenverwaltung
- [ ] Kundenhistorie
- [ ] Notizen pro Kunde

### Geplante Features
- Google Kalender Integration (Terminplanung)
- Auftragsverwaltung
- Lieferplanung
- PDF-Rechnungen
- Statistiken & Auswertungen

## 🛠️ Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | Vue.js 3 (CDN) |
| Styling | Custom CSS |
| Auth & DB | Supabase |
| Hosting | GitHub Pages |
| PWA | Web App Manifest |

## 📱 Installation als App

### Auf dem Smartphone (iOS/Android):

1. Öffne die Website in Safari (iOS) oder Chrome (Android)
2. Tippe auf "Teilen" (iOS) oder Menü (Android)
3. Wähle "Zum Home-Bildschirm"
4. Die App erscheint wie eine native App!

## 🚀 Setup

### 1. Supabase Projekt erstellen

1. Gehe zu https://supabase.com
2. Kostenlosen Account erstellen (mit Google oder Email)
3. "New Project" klicken
4. Project Name: `FireWoodFlow`
5. Database Password: sicheres Passwort wählen
6. Region: nächstgelegene wählen (z.B. Frankfurt)
7. Warten bis das Projekt bereit ist (~2 Min)

### 2. API Keys kopieren

In deinem Supabase Projekt:
1. Links auf **Settings** (Zahnrad)
2. Dann **API**
3. Kopiere diese Werte:
   - **Project URL** → `SUPABASE_URL`
   - **anon/public key** → `SUPABASE_ANON_KEY`

### 3. Keys in der App eintragen

Ersetze in folgenden Dateien die Platzhalter:

**app/js/login.js** (Zeilen 9-10):
```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbG...';
```

**app/js/dashboard.js** (Zeilen 9-10):
```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbG...';
```

### 4. Datenbank Tabellen erstellen

In Supabase links auf **SQL Editor** → **New Query**:

```sql
-- Tabelle für Produkte/Inventar
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    name TEXT NOT NULL,
    wood_type TEXT NOT NULL,
    log_length INTEGER NOT NULL,
    dryness TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für Kunden
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security aktivieren
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policies: Jeder User sieht nur seine eigenen Daten
CREATE POLICY "Users can view own products" ON products
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" ON products
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" ON products
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" ON products
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own customers" ON customers
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customers" ON customers
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customers" ON customers
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own customers" ON customers
    FOR DELETE USING (auth.uid() = user_id);
```

Query ausführen (grüner Play-Button).

### 5. GitHub Pages aktualisieren

Die Dateien sind bereits im Repo. Nach dem Push ist die App live unter:

**https://brennholzjohannsen.github.io/FireWoddFlow/app/index.html**

### 6. Ersten User registrieren

1. Öffne die Login-Seite
2. Klicke auf "Jetzt registrieren"
3. Gib deine Email ein (`brennholzjohannsen@gmail.com`)
4. Wähle ein sicheres Passwort
5. Bestätige die Email (falls in Supabase aktiviert)

Fertig! 🎉

---

## 📁 Projektstruktur

```
FireWoddFlow/
├── app/
│   ├── index.html          # Login-Seite
│   ├── dashboard.html      # Haupt-Dashboard
│   ├── css/
│   │   ├── login.css       # Login Styles
│   │   └── dashboard.css   # Dashboard Styles
│   ├── js/
│   │   ├── login.js        # Login Logic
│   │   └── dashboard.js    # Dashboard Logic
│   └── assets/             # Bilder, Icons
├── manifest.json           # PWA Manifest
├── index.html              # Landing Page (alte Demo)
└── README.md               # Diese Datei
```

## 🔐 Sicherheit

- Alle Daten sind durch Row Level Security geschützt
- Jeder User sieht nur seine eigenen Daten
- Passwörter werden gehasht gespeichert (durch Supabase)
- HTTPS ist durch GitHub Pages aktiviert

## 📝 Lizenz

MIT License - © 2026 BrennholzJohannsen
