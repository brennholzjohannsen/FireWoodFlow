-- ============================================
-- FireWoodFlow Migration 008
-- Fügt actual_distance_km Feld zu customers hinzu
-- Für realistische Lieferkosten-Berechnung (Option B)
-- ============================================

-- Füge actual_distance_km Spalte hinzu (gespeicherte tatsächliche Entfernung)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS actual_distance_km NUMERIC;

-- Füge distance_calculated_at Spalte hinzu (wann wurde die Distanz zuletzt berechnet/aktualisiert)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS distance_calculated_at TIMESTAMP WITH TIME ZONE;

-- Kommentar hinzufügen
COMMENT ON COLUMN customers.actual_distance_km IS 'Tatsächliche Entfernung in KM vom Lager zur Kundenadresse';
COMMENT ON COLUMN customers.distance_calculated_at IS 'Zeitpunkt der letzten Distanzberechnung';

-- Bestehende Kunden mit berechneten Distanzen könnten hier aktualisiert werden (optional)
-- UPDATE customers SET actual_distance_km = ... WHERE ...
