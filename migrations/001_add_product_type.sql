-- ============================================
-- Migration: Produktart-Feld hinzufügen
-- Datum: 2026-05-21
-- Beschreibung: Fügt product_type Spalte zur products Tabelle hinzu
-- ============================================

-- Neue Spalte hinzufügen mit Default-Wert 'Brennholz' für bestehende Datensätze
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'Brennholz';

-- Bestehende Produkte auf 'Brennholz' setzen (falls sie vor dieser Migration erstellt wurden)
UPDATE products 
SET product_type = 'Brennholz' 
WHERE product_type IS NULL;

-- Kommentar zur Spalte hinzufügen
COMMENT ON COLUMN products.product_type IS 'Art des Produkts: Brennholz, Anzündholz, etc.';
