-- ============================================
-- FireWoodFlow: Inventory Settings Table
-- ============================================
-- Speichert Inventar-Konfiguration zentral in der Datenbank
-- Erstellt: 2026-05-18
-- ============================================

-- Tabelle für Inventar-Einstellungen erstellen
CREATE TABLE IF NOT EXISTS inventory_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Holzsorten als JSON Array
    wood_types JSONB DEFAULT '[]'::jsonb,
    
    -- Trocknungsgrade als JSON Array
    dryness_levels JSONB DEFAULT '[]'::jsonb,
    
    -- Scheitlängen als JSON Array
    log_lengths JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE inventory_settings IS 'Inventar-Konfiguration: Holzsorten, Trocknungsgrade, Scheitlängen';
COMMENT ON COLUMN inventory_settings.wood_types IS 'Array aktiver Holzsorten (z.B. ["Buche", "Eiche"])';
COMMENT ON COLUMN inventory_settings.dryness_levels IS 'Array von Trocknungsgrad-Objekten {key, label, active}';
COMMENT ON COLUMN inventory_settings.log_lengths IS 'Array verfügbarer Scheitlängen in cm (z.B. [25, 33, 50, 100])';

-- Index für schnellen Zugriff nach User
CREATE INDEX IF NOT EXISTS idx_inventory_settings_user ON inventory_settings(user_id);

-- Row Level Security aktivieren
ALTER TABLE inventory_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder User sieht nur eigene Einstellungen
CREATE POLICY "Users can view own inventory settings"
    ON inventory_settings
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Jeder User kann eigene Einstellungen erstellen/aktualisieren
CREATE POLICY "Users can upsert own inventory settings"
    ON inventory_settings
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Trigger für automatische updated_at Aktualisierung
CREATE OR REPLACE FUNCTION update_inventory_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_settings_timestamp
    BEFORE UPDATE ON inventory_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_inventory_settings_updated_at();

-- Initiale leere Zeile für jeden neuen User (optional, wird auch beim ersten Speichern erstellt)
-- INSERT INTO inventory_settings (user_id, wood_types, dryness_levels, log_lengths)
-- VALUES (auth.uid(), '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
-- ON CONFLICT (user_id) DO NOTHING;
