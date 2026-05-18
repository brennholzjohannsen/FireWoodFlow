-- ============================================
-- FireWoodFlow: Storage Locations Table
-- ============================================
-- Speichert Holzlagerplätze zentral in der Datenbank
-- Erstellt: 2026-05-18
-- ============================================

-- Tabelle für Lagerplätze erstellen
CREATE TABLE IF NOT EXISTS storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    coordinates_lat DECIMAL(10, 8),
    coordinates_lng DECIMAL(11, 8),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE storage_locations IS 'Holzlagerplätze mit Adressen und Koordinaten';
COMMENT ON COLUMN storage_locations.name IS 'Name des Lagers (z.B. "Lager Waldweg")';
COMMENT ON COLUMN storage_locations.address IS 'Vollständige Adresse für Navigation';
COMMENT ON COLUMN storage_locations.coordinates_lat IS 'Breitengrad für Maps';
COMMENT ON COLUMN storage_locations.coordinates_lng IS 'Längengrad für Maps';
COMMENT ON COLUMN storage_locations.is_active IS 'Ob dieser Lagerplatz aktiv genutzt wird';
COMMENT ON COLUMN storage_locations.sort_order IS 'Reihenfolge in Dropdowns (0 = erster/default)';

-- Index für schnellen Zugriff nach User
CREATE INDEX IF NOT EXISTS idx_storage_locations_user ON storage_locations(user_id);

-- Index für Sortierung
CREATE INDEX IF NOT EXISTS idx_storage_locations_sort ON storage_locations(sort_order);

-- Row Level Security aktivieren
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Jeder User sieht nur eigene Lagerplätze
CREATE POLICY "Users can view own storage locations"
    ON storage_locations
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Jeder User kann eigene Lagerplätze erstellen
CREATE POLICY "Users can insert own storage locations"
    ON storage_locations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Jeder User kann eigene Lagerplätze aktualisieren
CREATE POLICY "Users can update own storage locations"
    ON storage_locations
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Jeder User kann eigene Lagerplätze löschen
CREATE POLICY "Users can delete own storage locations"
    ON storage_locations
    FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger für automatische updated_at Aktualisierung
CREATE OR REPLACE FUNCTION update_storage_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_storage_locations_timestamp
    BEFORE UPDATE ON storage_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_storage_locations_updated_at();
