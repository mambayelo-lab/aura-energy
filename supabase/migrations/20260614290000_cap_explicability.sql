-- CAP Explicability Layer
-- Adds confidence_pct, impact_estimate_label, explanation to decision_recommendations
-- Seeds all 26 recommendations with CAP-driven explanations

ALTER TABLE decision_recommendations
  ADD COLUMN IF NOT EXISTS confidence_pct INTEGER CHECK (confidence_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS impact_estimate_label TEXT,
  ADD COLUMN IF NOT EXISTS explanation TEXT;

-- ── CASH-S001 ────────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 88,
  impact_estimate_label = '+2,4 M€ de cash récupéré',
  explanation = 'Impact maximal (9/10) et faisabilité forte (8/10). Score CAP min(9,8)=8 — équilibre optimal profitabilité/exécution. Action exécutable en 48h sans investissement. C''est l''action n°1 recommandée par le moteur CAP.'
WHERE signal_code = 'CASH-S001' AND title ILIKE '%relances clients%';

UPDATE decision_recommendations SET
  confidence_pct = 68,
  impact_estimate_label = '+1,5 à 3 M€ de capacité',
  explanation = 'Filet de sécurité rapide. Impact fort (8/10) mais processus bancaire (~2 semaines). Score CAP min(8,6)=6. À activer en parallèle si le recouvrement ne suffit pas dans les 30 jours.'
WHERE signal_code = 'CASH-S001' AND title ILIKE '%ligne de crédit%';

UPDATE decision_recommendations SET
  confidence_pct = 75,
  impact_estimate_label = '+800K€ à 1,2 M€ préservés',
  explanation = 'Décision de préservation du cash. Facile à exécuter (8/10) mais impact modéré (5/10). Score CAP min(5,8)=5. Complémentaire aux deux premières actions — à décider rapidement pour sécuriser le cash.'
WHERE signal_code = 'CASH-S001' AND title ILIKE '%investissements%';

-- ── CASH-S002 ────────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 82,
  impact_estimate_label = '-8 jours DSO estimé',
  explanation = 'Action structurelle sur le DSO. Impact fort (8/10) et mise en place rapide (8/10). Score CAP min(8,8)=8 — recommandé en priorité pour réduire l''exposition client de manière durable.'
WHERE signal_code = 'CASH-S002' AND title ILIKE '%conditions strictes%';

UPDATE decision_recommendations SET
  confidence_pct = 70,
  impact_estimate_label = '+600K€ à 1,2 M€ encaissés',
  explanation = 'Incitation financière à payer rapidement. Efficace sur clients solvables mais coût = escompte 1-2%. Score CAP min(7,7)=7. Action complémentaire si les conditions strictes restent insuffisantes.'
WHERE signal_code = 'CASH-S002' AND title ILIKE '%escompte%';

-- ── STOCK-S001 ───────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 90,
  impact_estimate_label = '-95% risque de rupture',
  explanation = 'Action la plus directe contre la rupture imminente. Impact 8/10, exécution immédiate. Score CAP min(8,9)=8 — immobilise du capital mais élimine le risque business critique. Recommandé en urgence.'
WHERE signal_code = 'STOCK-S001' AND title ILIKE '%stock de sécurité%';

UPDATE decision_recommendations SET
  confidence_pct = 80,
  impact_estimate_label = '-80% risque de rupture',
  explanation = 'Diversification critique du sourcing. Impact maximal (9/10) mais délai de qualification fournisseur 1-2 semaines. Score CAP min(9,7)=7. Action structurelle pour éviter les récidives — à déclencher en parallèle.'
WHERE signal_code = 'STOCK-S001' AND title ILIKE '%fournisseur de secours%';

UPDATE decision_recommendations SET
  confidence_pct = 85,
  impact_estimate_label = 'Continuité opérationnelle garantie',
  explanation = 'Action d''urgence immédiate pour couvrir le risque à court terme. Coût logistique supérieur (+15-20%) mais garantit la continuité. Score CAP min(9,9)=9 — à déclencher maintenant si la rupture est imminente.'
WHERE signal_code = 'STOCK-S001' AND title ILIKE '%commande urgente%';

-- ── STOCK-S002 ───────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 82,
  impact_estimate_label = '-25% stock excédentaire',
  explanation = 'Ajuster les prévisions réduit les réapprovisionnements inutiles. Impact fort (8/10), faisabilité forte (8/10). Score CAP min(8,8)=8 — action structurelle recommandée en priorité pour éviter la récidive.'
WHERE signal_code = 'STOCK-S002' AND title ILIKE '%prévisions%';

UPDATE decision_recommendations SET
  confidence_pct = 75,
  impact_estimate_label = '+1,5 M€ de stock écoulé',
  explanation = 'Mobiliser le commercial pour écouler le surstock via promotions ou ventes B2B. Impact fort (8/10) si exécuté activement. Score CAP min(8,7)=7. Complémentaire à la révision des prévisions.'
WHERE signal_code = 'STOCK-S002' AND title ILIKE '%commerciales%';

-- ── STOCK-S003 ───────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 85,
  impact_estimate_label = 'Diagnostic sous 5 jours',
  explanation = 'Comprendre la cause du retard avant de décider. Faisabilité maximale (10/10), impact certain (8/10). Score CAP min(8,10)=8 — pré-requis indispensable aux deux actions suivantes. À lancer immédiatement.'
WHERE signal_code = 'STOCK-S003' AND title ILIKE '%audit fournisseur%';

UPDATE decision_recommendations SET
  confidence_pct = 78,
  impact_estimate_label = '-70% risque retard structurel',
  explanation = 'Diversifier le sourcing = résilience durable. Impact fort (8/10) mais délai qualification 2-4 semaines. Score CAP min(8,7)=7. Action prioritaire structurelle — à enclencher dès l''audit terminé.'
WHERE signal_code = 'STOCK-S003' AND title ILIKE '%fournisseur alternatif%';

UPDATE decision_recommendations SET
  confidence_pct = 70,
  impact_estimate_label = '-30% délais de livraison',
  explanation = 'Formaliser les pénalités de retard protège durablement. Impact modéré court terme mais fort long terme. Score CAP min(7,7)=7. À négocier dès l''audit terminé et parallèlement à la recherche d''alternatives.'
WHERE signal_code = 'STOCK-S003' AND title ILIKE '%SLA%';

-- ── SUPP-S001 ────────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 88,
  impact_estimate_label = '-80% exposition à la défaillance',
  explanation = 'Action #1 face à un fournisseur critique en difficulté. Impact maximal (9/10). Score CAP min(9,8)=8 — meilleur équilibre urgence/exécutabilité. Plan de continuité à déclencher dans les 48h.'
WHERE signal_code = 'SUPP-S001' AND title ILIKE '%continuité%';

UPDATE decision_recommendations SET
  confidence_pct = 78,
  impact_estimate_label = 'Alerte précoce défaillance',
  explanation = 'Surveiller les signaux financiers du fournisseur en temps réel. Faisabilité maximale (9/10), impact informatif mais crucial. Score CAP min(7,9)=7. Permet d''anticiper la défaillance avant qu''elle soit inévitable.'
WHERE signal_code = 'SUPP-S001' AND title ILIKE '%monitoring%';

UPDATE decision_recommendations SET
  confidence_pct = 72,
  impact_estimate_label = '-50% exposition financière',
  explanation = 'Réduire les commandes et avances au fournisseur en difficulté. Action défensive. Score CAP min(8,6)=6. Délai d''exécution 2-4 semaines mais réduit l''exposition immédiatement tout en préservant la relation.'
WHERE signal_code = 'SUPP-S001' AND title ILIKE '%concentration%';

-- ── MARG-S001 ────────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 78,
  impact_estimate_label = '+1,2 à 1,8 pt de marge',
  explanation = 'Remonter les prix sur lignes à faible élasticité. Impact fort (8/10). Score CAP min(8,6)=6. Nécessite analyse marché préalable mais c''est l''action la plus impactante sur la marge structurelle à 3-6 mois.'
WHERE signal_code = 'MARG-S001' AND title ILIKE '%tarifaire%';

UPDATE decision_recommendations SET
  confidence_pct = 85,
  impact_estimate_label = '-0,8 à 1,2 pt de coût',
  explanation = 'Identifier les postes logistiques compressibles. Faisabilité forte (9/10), impact certain (7/10). Score CAP min(7,9)=7 — recommandé en priorité car exécutable rapidement sans risque commercial ni pression client.'
WHERE signal_code = 'MARG-S001' AND title ILIKE '%logistiques%';

UPDATE decision_recommendations SET
  confidence_pct = 72,
  impact_estimate_label = '+2 pts de marge mix',
  explanation = 'Éliminer les produits qui tirent la marge vers le bas. Impact très fort (9/10) mais décision commerciale sensible (faisabilité 5/10). Score CAP min(9,5)=5. À étudier après optimisation logistique et révision tarifaire.'
WHERE signal_code = 'MARG-S001' AND title ILIKE '%SKU%';

-- ── TRANSFO-S001 ─────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 88,
  impact_estimate_label = '-30% dérive budgétaire',
  explanation = 'Recadrer le projet en urgence. Impact direct (9/10), exécution rapide (9/10). Score CAP min(9,9)=9 — action #1 de gouvernance projet. Réunion de crise à convoquer dans les 48h avec le sponsor et le chef de projet.'
WHERE signal_code = 'TRANSFO-S001' AND title ILIKE '%revue%';

UPDATE decision_recommendations SET
  confidence_pct = 80,
  impact_estimate_label = 'Recentrage sur 80% de la valeur',
  explanation = 'Réduire le périmètre pour retrouver la maîtrise budgétaire. Impact fort si bien exécuté (8/10). Score CAP min(8,7)=7. Libère des ressources et restaure la confiance des parties prenantes sur la livraison.'
WHERE signal_code = 'TRANSFO-S001' AND title ILIKE '%scope%';

UPDATE decision_recommendations SET
  confidence_pct = 75,
  impact_estimate_label = '-60% risque récidive dérive',
  explanation = 'Comité de pilotage hebdomadaire + reporting rigoureux. Action structurelle préventive. Score CAP min(7,8)=7. Complémentaire à la revue d''urgence pour ancrer la discipline projet et éviter la récidive.'
WHERE signal_code = 'TRANSFO-S001' AND title ILIKE '%gouvernance%';

-- ── AIREADY-S001 ─────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 72,
  impact_estimate_label = '+60% données accessibles',
  explanation = 'Exposer les données SI via API sans refonte du SI. Impact fort (7/10) si bien exécuté. Score CAP min(7,6)=6. Solution de contournement efficace en attendant une vraie gouvernance données — délai 4-6 semaines.'
WHERE signal_code = 'AIREADY-S001' AND title ILIKE '%API%';

UPDATE decision_recommendations SET
  confidence_pct = 80,
  impact_estimate_label = '+40% données exploitables',
  explanation = 'Pipeline ETL rapide pour rendre les données exploitables immédiatement. Impact modéré (6/10) mais faisabilité forte (8/10). Score CAP min(6,8)=6. Solution la plus rapide à mettre en place — résultats sous 2 semaines.'
WHERE signal_code = 'AIREADY-S001' AND title ILIKE '%ETL%';

-- ── AIREADY-S002 ─────────────────────────────────────────────────────────────
UPDATE decision_recommendations SET
  confidence_pct = 82,
  impact_estimate_label = '+40% qualité données',
  explanation = 'Sprint 4 semaines pour nettoyer et structurer les données critiques. Impact fort (8/10), faisabilité forte (8/10). Score CAP min(8,8)=8 — pré-requis fondamental pour tout projet IA. Recommandé en priorité absolue.'
WHERE signal_code = 'AIREADY-S002' AND title ILIKE '%qualité données%';

UPDATE decision_recommendations SET
  confidence_pct = 78,
  impact_estimate_label = 'Durabilité qualité données',
  explanation = 'Responsabiliser chaque domaine métier sur ses données. Faisabilité maximale (9/10), impact fort long terme (7/10). Score CAP min(7,9)=7. Complète le programme qualité pour ancrer durablement la culture data dans l''organisation.'
WHERE signal_code = 'AIREADY-S002' AND title ILIKE '%Data Owner%';
