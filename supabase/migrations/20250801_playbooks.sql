-- ─── Aura V4 — Playbooks table ───────────────────────────────────────────────
-- À exécuter dans le dashboard Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS aura_playbooks (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  icon        TEXT,
  domain      TEXT,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la recherche par domaine
CREATE INDEX IF NOT EXISTS idx_aura_playbooks_domain ON aura_playbooks(domain);

-- RLS : lecture publique (anon), écriture authentifiée uniquement
ALTER TABLE aura_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "playbooks_read_all" ON aura_playbooks
  FOR SELECT USING (true);

CREATE POLICY "playbooks_write_authenticated" ON aura_playbooks
  FOR ALL USING (auth.role() = 'authenticated');

-- Trigger updated_at automatique
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER aura_playbooks_updated_at
  BEFORE UPDATE ON aura_playbooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
