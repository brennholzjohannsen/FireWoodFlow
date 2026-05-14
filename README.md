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

**Option A: Komplettes Schema (empfohlen)**

Kopiere den Inhalt der Datei `database-setup.sql` und führe ihn aus.

**Option B: Manuell**

```sql
-- Tabelle für Produkte/Inventar
CREATE TABLE IF NOT EXISTS products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    name TEXT NOT NULL,
    wood_type TEXT NOT NULL,
    log_length INTEGER NOT NULL,
    dryness TEXT NOT NULL,
    quantity NUMERIC NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'RM',
    price_lengths JSONB, -- { "25": { "srm": 100, "rm": 142 }, "33": { "srm": 110, "rm": 156 } }
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für Kunden
CREATE TABLE IF NOT EXISTS customers (
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

-- Tabelle für Bestellungen/Aufträge
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    customer_id UUID REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    customer_address TEXT,
    delivery_address TEXT,
    items JSONB NOT NULL, -- [{ product_id, quantity, unit, log_length, price }]
    subtotal NUMERIC DEFAULT 0,
    delivery_costs NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    payment_method TEXT DEFAULT 'bar',
    payment_status TEXT DEFAULT 'offen',
    delivery_date DATE,
    delivery_time TIME,
    status TEXT DEFAULT 'neu', -- neu, bestätigt, geliefert, erledigt, storniert
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabelle für Firmeneinstellungen
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users UNIQUE NOT NULL,
    company_name TEXT DEFAULT 'FireWoodFlow',
    company_logo TEXT, -- Base64 encoded image
    company_address TEXT,
    storage_location TEXT,
    cost_per_km NUMERIC DEFAULT 0,
    rounding_mode TEXT DEFAULT 'exact', -- exact, 10cent, 50cent, 1euro
    inventory_settings JSONB, -- { woodTypes, drynessLevels, logLengths }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security aktivieren
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Policies für alle Tabellen (Users sehen nur eigene Daten)
CREATE POLICY "Users can view own products" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON products FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own customers" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customers" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customers" ON customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own customers" ON customers FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own orders" ON orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own orders" ON orders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own settings" ON company_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON company_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON company_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON company_settings FOR DELETE USING (auth.uid() = user_id);

-- Indexes für bessere Performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_company_settings_user_id ON company_settings(user_id);
```

Query ausführen (grüner Play-Button).

### 5. GitHub Pages aktualisieren

Die Dateien sind bereits im Repo. Nach dem Push ist die App live unter:

**https://brennholzjohannsen.github.io/FireWoodFlow/app/index.html**

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
