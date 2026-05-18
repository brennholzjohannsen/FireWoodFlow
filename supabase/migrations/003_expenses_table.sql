-- ============================================
-- FireWoodFlow: Expenses Table Migration
-- ============================================
-- Diese Tabelle speichert alle Ausgaben (Sprit, Wartung, etc.)
-- Erstellt: 2026-05-18
-- ============================================

-- Expenses Tabelle erstellen
CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Abfragen nach Datum
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date DESC);

-- Index für Kategorie-Filter
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Row Level Security aktivieren
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policy: User können nur ihre eigenen Ausgaben sehen
CREATE POLICY "Users can view own expenses"
    ON expenses
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: User können eigene Ausgaben erstellen
CREATE POLICY "Users can insert own expenses"
    ON expenses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: User können eigene Ausgaben aktualisieren
CREATE POLICY "Users can update own expenses"
    ON expenses
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: User können eigene Ausgaben löschen
CREATE POLICY "Users can delete own expenses"
    ON expenses
    FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Kommentare für bessere Dokumentation
COMMENT ON TABLE expenses IS 'Speichert alle Geschäftsausgaben für FireWoodFlow';
COMMENT ON COLUMN expenses.amount IS 'Betrag in Euro';
COMMENT ON COLUMN expenses.category IS 'Kategorie: fuel, maintenance, insurance, material, tools, office, other';
COMMENT ON COLUMN expenses.date IS 'Datum der Ausgabe';
