-- ============================================
-- FireWoodFlow Migration 007
-- Fügt status_updated_at Feld zu orders hinzu
-- Für Activity-Feed Tracking von Statusänderungen
-- ============================================

-- Füge status_updated_at Spalte hinzu
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE;

-- Setze初始值 für bestehende Orders auf created_at (da sie zum Erstellungszeitpunkt den ersten Status bekamen)
UPDATE orders 
SET status_updated_at = created_at 
WHERE status_updated_at IS NULL;

-- Kommentar hinzufügen
COMMENT ON COLUMN orders.status_updated_at IS 'Zeitpunkt der letzten Statusänderung';
