-- ============================================
-- FireWoodFlow: Add Storage Location Index to Orders & Expenses
-- ============================================
-- Fügt Lagerplatz-Zuordnung hinzu für getrennte Gewinnberechnung
-- Erstellt: 2026-05-18
-- ============================================

-- Spalte zu orders Tabelle hinzufügen
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS storage_location_index INTEGER DEFAULT 0;

COMMENT ON COLUMN orders.storage_location_index IS 'Index des Lagerplatzes (0 = erster/default)';

-- Spalte zu expenses Tabelle hinzufügen
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS storage_location_index INTEGER DEFAULT 0;

COMMENT ON COLUMN expenses.storage_location_index IS 'Index des Lagerplatzes dem die Ausgabe zugeordnet ist (0 = allgemein/alle)';

-- Indizes für schnelle Filterung nach Lagerplatz
CREATE INDEX IF NOT EXISTS idx_orders_storage_location ON orders(storage_location_index);
CREATE INDEX IF NOT EXISTS idx_expenses_storage_location ON expenses(storage_location_index);
