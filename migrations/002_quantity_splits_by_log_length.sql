-- ============================================
-- Migration: Scheitlängen-Aufteilung hinzufügen
-- Datum: 2026-05-22
-- Beschreibung: Ermöglicht Aufteilung der Produktmenge auf verschiedene Scheitlängen
-- Beispiel: 10 FM gekauft → 8 FM in 100cm, 1 FM in 33cm, 1 FM in 25cm
-- ============================================

-- Neue Spalte hinzufügen: JSONB für Mengenaufteilung nach Scheitlängen
-- Struktur: { "100": { "quantity": 8, "unit": "FM" }, "33": { "quantity": 1, "unit": "FM" }, "25": { "quantity": 1, "unit": "FM" } }
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS quantity_splits JSONB DEFAULT '{}';

-- Kommentar zur Spalte hinzufügen
COMMENT ON COLUMN products.quantity_splits IS 'Aufteilung der Gesamtmenge auf verschiedene Scheitlängen';

-- Bestehende Produkte migrieren: Aktuelle Scheitlänge als einzigen Eintrag übernehmen
UPDATE products 
SET quantity_splits = jsonb_build_object(log_length::text, jsonb_build_object('quantity', quantity, 'unit', unit))
WHERE quantity_splits IS NULL OR quantity_splits = '{}';
