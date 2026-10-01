-- Signal Contributors — the "Pourquoi ce signal ?" layer
-- Adds contributor breakdown to signal_rules so every signal can show
-- what causal factors drove it and with what relative weight.
-- Format: [{"label": "Stock faible", "pct": 40, "direction": "negative|positive"}]

ALTER TABLE signal_rules
  ADD COLUMN IF NOT EXISTS contributors JSONB;

-- ── STOCK-S001 : Rupture imminente ───────────────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Niveau de stock sous seuil critique", "pct": 40, "direction": "negative"},
  {"label": "Délai fournisseur anormal", "pct": 30, "direction": "negative"},
  {"label": "Hausse de demande imprévue", "pct": 20, "direction": "negative"},
  {"label": "Prévision sous-estimée", "pct": 10, "direction": "negative"}
]' WHERE code = 'STOCK-S001';

-- ── STOCK-S002 : Surstock ────────────────────────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Demande inférieure aux prévisions", "pct": 45, "direction": "negative"},
  {"label": "Réapprovisionnement excessif", "pct": 35, "direction": "negative"},
  {"label": "Saisonnalité non intégrée", "pct": 20, "direction": "negative"}
]' WHERE code = 'STOCK-S002';

-- ── STOCK-S003 : Délai fournisseur ───────────────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Retard fournisseur récurrent", "pct": 50, "direction": "negative"},
  {"label": "Absence de SLA contractuel", "pct": 30, "direction": "negative"},
  {"label": "Mono-sourcing", "pct": 20, "direction": "negative"}
]' WHERE code = 'STOCK-S003';

-- ── CASH-S001 : Cash Risk ────────────────────────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Recouvrement client lent (DSO élevé)", "pct": 45, "direction": "negative"},
  {"label": "Stock excédentaire immobilisé", "pct": 28, "direction": "negative"},
  {"label": "Investissements en cours non différés", "pct": 17, "direction": "negative"},
  {"label": "Saisonnalité défavorable", "pct": 10, "direction": "negative"}
]' WHERE code = 'CASH-S001';

-- ── CASH-S002 : DSO élevé ────────────────────────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Processus de relance insuffisant", "pct": 40, "direction": "negative"},
  {"label": "Clients à délais longs non suivis", "pct": 35, "direction": "negative"},
  {"label": "Absence d''escompte de paiement", "pct": 25, "direction": "negative"}
]' WHERE code = 'CASH-S002';

-- ── SUPP-S001 : Risque fournisseur ───────────────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Signes de fragilité financière", "pct": 50, "direction": "negative"},
  {"label": "Concentration >40% sur ce fournisseur", "pct": 30, "direction": "negative"},
  {"label": "Historique de retards et incidents", "pct": 20, "direction": "negative"}
]' WHERE code = 'SUPP-S001';

-- ── MARG-S001 : Érosion de marge ────────────────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Hausse des coûts logistiques", "pct": 38, "direction": "negative"},
  {"label": "Pression tarifaire clients", "pct": 32, "direction": "negative"},
  {"label": "Mix produit défavorable", "pct": 18, "direction": "negative"},
  {"label": "Sous-utilisation capacités", "pct": 12, "direction": "negative"}
]' WHERE code = 'MARG-S001';

-- ── TRANSFO-S001 : Projet en dérive ─────────────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Dépassement budgétaire >15%", "pct": 42, "direction": "negative"},
  {"label": "Retard de livraison >3 semaines", "pct": 33, "direction": "negative"},
  {"label": "Scope creep non gouverné", "pct": 25, "direction": "negative"}
]' WHERE code = 'TRANSFO-S001';

-- ── AIREADY-S001 : Données insuffisantes ────────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Qualité données < 70%", "pct": 45, "direction": "negative"},
  {"label": "Silos SI non interconnectés", "pct": 35, "direction": "negative"},
  {"label": "Absence de gouvernance données", "pct": 20, "direction": "negative"}
]' WHERE code = 'AIREADY-S001';

-- ── AIREADY-S002 : Compétences manquantes ───────────────────────────────────
UPDATE signal_rules SET contributors = '[
  {"label": "Absence de profil Data/IA en interne", "pct": 50, "direction": "negative"},
  {"label": "Culture data immature", "pct": 30, "direction": "negative"},
  {"label": "Pas de roadmap IA formalisée", "pct": 20, "direction": "negative"}
]' WHERE code = 'AIREADY-S002';

-- Also add criteria_interactions JSONB to decision_packs to model antagonistic/complementary pairs
ALTER TABLE decision_packs
  ADD COLUMN IF NOT EXISTS criteria_interactions JSONB;

UPDATE decision_packs SET criteria_interactions = '[
  {"criteria": ["disponibilite_stock", "cout_stockage"], "relation": "antagoniste", "note": "Augmenter le stock réduit la rupture mais augmente les coûts"},
  {"criteria": ["disponibilite_stock", "fiabilite_fournisseur"], "relation": "complementaire", "note": "Un fournisseur fiable améliore directement la disponibilité"}
]' WHERE slug = 'stock-availability';

UPDATE decision_packs SET criteria_interactions = '[
  {"criteria": ["tresorerie", "delai_recouvrement"], "relation": "antagoniste", "note": "Un DSO élevé dégrade directement la trésorerie"},
  {"criteria": ["tresorerie", "niveau_stock"], "relation": "antagoniste", "note": "Surstock immobilise du cash"}
]' WHERE slug = 'cash-management';

UPDATE decision_packs SET criteria_interactions = '[
  {"criteria": ["fiabilite_fournisseur", "concentration_sourcing"], "relation": "antagoniste", "note": "Mono-sourcing amplifie le risque fournisseur"},
  {"criteria": ["fiabilite_fournisseur", "diversification"], "relation": "complementaire", "note": "Multi-sourcing réduit l''exposition"}
]' WHERE slug = 'supplier-risk';
