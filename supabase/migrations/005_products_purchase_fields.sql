-- ============================================
-- FireWoodFlow: Products Table - Purchase Date & Price Fields
-- ============================================
-- Fügt Felder für Wareneinkauf-Datum und Preise hinzu
-- Erstellt: 2026-05-21
-- ============================================

-- Neue Spalten für Produkte hinzufügen
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_unit TEXT DEFAULT 'RM',
ADD COLUMN IF NOT EXISTS storage_location_index INTEGER,
ADD COLUMN IF NOT EXISTS purchase_date DATE;

-- Kommentare für bessere Dokumentation
COMMENT ON COLUMN products.price IS 'Einkaufspreis pro Einheit';
COMMENT ON COLUMN products.price_unit IS 'Einheit für den Einkaufspreis (FM, RM, SRM)';
COMMENT ON COLUMN products.storage_location_index IS 'Index des Lagerorts';
COMMENT ON COLUMN products.purchase_date IS 'Datum des Wareneinkaufs';

-- Index für Datum-Abfragen
CREATE INDEX IF NOT EXISTS idx_products_purchase_date ON products(purchase_date DESC);
