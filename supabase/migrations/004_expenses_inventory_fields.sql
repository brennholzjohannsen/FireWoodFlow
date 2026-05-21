-- ============================================
-- FireWoodFlow: Expenses Table - Inventory Purchase Fields
-- ============================================
-- Fügt Felder für automatische Wareneinkäufe hinzu
-- Erstellt: 2026-05-21
-- ============================================

-- Neue Spalten für Wareneinkäufe hinzufügen
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS storage_location_index INTEGER,
ADD COLUMN IF NOT EXISTS is_inventory_purchase BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Index für Wareneinkäufe
CREATE INDEX IF NOT EXISTS idx_expenses_inventory ON expenses(is_inventory_purchase);

-- Kommentare
COMMENT ON COLUMN expenses.storage_location_index IS 'Index des Lagerorts (für Zuordnung zu Lager)';
COMMENT ON COLUMN expenses.is_inventory_purchase IS 'True wenn automatisch beim Produkt-Anlegen erstellt';
COMMENT ON COLUMN expenses.product_id IS 'Verknüpfung zum Produkt bei Wareneinkäufen';
