# 🔧 Google OAuth Backend Implementation (TODO)

## Übersicht

Diese Dateien bereiten die vollständige Google OAuth Integration vor. Wenn du Phase 3 umsetzen möchtest, folge diesen Schritten:

---

## 📋 Was bereits fertig ist

✅ **Frontend (Phase 2):**
- OAuth Popup öffnet sich
- Redirect zu Google Login
- Callback Handler (`oauth-callback.html`)
- UI in Einstellungen

⏳ **Backend (Phase 3 - TODO):**
- Supabase Edge Function für Token Exchange
- Datenbank-Tabelle für Tokens
- Automatische Calendar-Sync beim Speichern

---

## 🗄️ Schritt 1: Datenbank-Tabelle erstellen

Führe dieses SQL im **Supabase SQL Editor** aus:

```sql
-- ============================================
-- FireWoodFlow: Google Calendar Tokens Table
-- ============================================

-- Tabelle für OAuth Tokens erstellen
CREATE TABLE IF NOT EXISTS public.google_calendar_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    calendar_id TEXT DEFAULT 'primary',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index für schnelleren Zugriff
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id 
ON public.google_calendar_tokens(user_id);

-- Row Level Security aktivieren
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: User können nur ihre eigenen Tokens sehen
CREATE POLICY "Users can view own tokens"
ON public.google_calendar_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: User können ihre eigenen Tokens updaten
CREATE POLICY "Users can update own tokens"
ON public.google_calendar_tokens
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: User können ihre eigenen Tokens einfügen
CREATE POLICY "Users can insert own tokens"
ON public.google_calendar_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: User können ihre eigenen Tokens löschen
CREATE POLICY "Users can delete own tokens"
ON public.google_calendar_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Kommentar hinzufügen
COMMENT ON TABLE public.google_calendar_tokens IS 
'Stores encrypted Google Calendar OAuth tokens for automatic calendar synchronization';

-- ============================================
-- Fertig! ✅
-- ============================================
```

**Ausführen:**
1. https://supabase.com/dashboard/project/qnwxbityxokrjoxsrnym/sql/new
2. SQL einfügen
3. "Run" klicken

---

## 🔐 Schritt 2: Environment Variables setzen

In deiner Supabase Dashboard:

1. Gehe zu: **Settings** → **Functions** → **Secrets**
2. Füge diese Secrets hinzu:

| Name | Wert | Beschreibung |
|------|------|--------------|
| `GOOGLE_CLIENT_ID` | `123456789-abc...apps.googleusercontent.com` | Deine Google Client-ID |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xyz789...` | Dein Google Client Secret |
| `OAUTH_REDIRECT_URI` | `https://brennholzjohannsen.github.io/FireWoodFlow/app/oauth-callback.html` | OAuth Callback URL |

**So findest du deine Credentials:**
- Google Cloud Console → APIs & Dienste → Anmeldedaten
- OAuth 2.0 Client IDs → Deine Web App

---

## ⚙️ Schritt 3: Supabase Edge Function deployen

### **Option A: Supabase CLI (Empfohlen)**

```bash
# Supabase CLI installieren
npm install -g supabase

# Einloggen
supabase login

# Mit deinem Projekt verknüpfen
supabase link --project-ref qnwxbityxokrjoxsrnym

# Function deployen
supabase functions deploy oauth-exchange
```

### **Option B: Manuelles Deploy im Dashboard**

1. Gehe zu: **Edge Functions** im Supabase Dashboard
2. Klick auf **"New Function"**
3. Name: `oauth-exchange`
4. Copy-Paste den Code aus `supabase/functions/oauth-exchange/index.ts`
5. Klick auf **"Deploy"**

---

## 🔧 Schritt 4: Frontend anpassen

Ersetze in `app/js/dashboard.js` die `connectGoogleCalendar()` Funktion:

**Aktueller Code (Zeile ~813):**
```javascript
// TODO: Ersetze diese Client-ID mit deiner eigenen
const CLIENT_ID = 'DEINE_GOOGLE_CLIENT_ID_HIER';
```

**Neuer Code:**
```javascript
// Echte Google Client-ID aus Google Cloud Console
const CLIENT_ID = '123456789-abc123def456.apps.googleusercontent.com'; // ← DEINE HIER
```

Und aktualisiere die Redirect URI:
```javascript
// redirectUri muss mit Google Cloud Console übereinstimmen
const redirectUri = encodeURIComponent('https://brennholzjohannsen.github.io/FireWoodFlow/app/oauth-callback.html');
```

---

## 🔄 Schritt 5: Automatische Synchronisation

Füge diese Funktion in `app/js/dashboard.js` hinzu:

```javascript
// Automatische Calendar-Sync beim Speichern einer Bestellung
async syncOrderToCalendar(order) {
    if (!this.googleCalendarConnected) return;
    
    try {
        // Access Token aus Supabase holen
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        
        // TODO: Edge Function aufrufen um Event zu erstellen
        const response = await fetch(
            'https://qnwxbityxokrjoxsrnym.supabase.co/functions/v1/oauth-exchange',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'create_event',
                    order: order
                })
            }
        );
        
        const result = await response.json();
        
        if (result.success) {
            // Event ID speichern für spätere Updates
            order.googleCalendarEventId = result.eventId;
            console.log('✓ Calendar Event erstellt:', result.eventId);
        } else {
            console.error('❌ Calendar Sync failed:', result.error);
        }
        
    } catch (error) {
        console.error('Error syncing to calendar:', error);
        // Fail silently - Calendar Sync ist optional
    }
}
```

Und rufe sie in `saveOrder()` auf:
```javascript
async saveOrder() {
    try {
        // ... bestehender Code ...
        
        await this.saveOrderToSupabase();
        
        // NEU: Calendar Sync
        await this.syncOrderToCalendar(this.editingOrder || this.newOrder);
        
        // ... Restlicher Code ...
    } catch (error) {
        // ... Error Handling ...
    }
}
```

---

## 🧪 Testen

### **Test 1: OAuth Flow**

```
1. Einstellungen → Google Calendar Integration

2. "Mit Google Kalender verbinden" klicken

3. Google Login Popup öffnet sich

4. Anmelden + Berechtigungen erlauben

5. Popup schließt sich automatisch

6. Erfolgsmeldung: "✓ Mit Google Kalender verbunden!"

7. Status zeigt: "Google Kalender verbunden" ✓
```

### **Test 2: Calendar Event erstellen**

```
1. Neue Bestellung erstellen

2. Lieferdatum: Morgen, 14:00 Uhr

3. Speichern

4. Google Calendar öffnen:
   https://calendar.google.com/

5. Termin sollte erscheinen:
   🚚 Lieferung an Max Mustermann
   Zeit: Morgen, 14:00-15:00
   Ort: Lieferadresse
   Beschreibung: Alle Bestelldetails
```

---

## 🔒 Sicherheitshinweise

### **Verschlüsselung:**

In Production solltest du die Tokens verschlüsseln:

```typescript
// Vor dem Speichern verschlüsseln
import { encrypt, decrypt } from 'https://deno.land/x/encryption@1.0.0/mod.ts';

const encryptedAccessToken = encrypt(tokenData.access_token, Deno.env.get('ENCRYPTION_KEY'));
const encryptedRefreshToken = encrypt(tokenData.refresh_token, Deno.env.get('ENCRYPTION_KEY'));
```

### **Token Refresh:**

Access Tokens laufen nach 1 Stunde ab. Implementiere automatisches Refresh:

```typescript
// In Edge Function oder als Cron Job
async refreshAccessToken(userId: string) {
    // Refresh Token aus DB holen
    const { data } = await supabase
        .from('google_calendar_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    // Bei Google refreshen
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
            client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
            client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
            refresh_token: decrypt(data.refresh_token),
            grant_type: 'refresh_token'
        })
    });
    
    // Neue Tokens speichern
    const newTokens = await response.json();
    // ... speichern ...
}
```

---

## 📊 Kosten

| Service | Free Tier | Dein Bedarf | Kosten |
|---------|-----------|-------------|--------|
| Supabase Edge Functions | 500K invocations/month | ~100/month | €0 |
| Calendar API Write | 100K requests/day | ~50/month | €0 |
| Database Storage | 500MB | <1MB | €0 |
| **Gesamt** | | | **€0/Jahr** |

---

## ❓ Support

Bei Fragen:
- **Supabase Docs:** https://supabase.com/docs/guides/functions
- **Google OAuth Docs:** https://developers.google.com/identity/protocols/oauth2
- **Calendar API:** https://developers.google.com/calendar/api/guides/overview

---

**Viel Erfolg bei der Umsetzung!** 🚀
