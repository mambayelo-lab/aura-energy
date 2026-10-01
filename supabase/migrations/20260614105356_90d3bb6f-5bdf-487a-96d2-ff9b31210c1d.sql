
CREATE TABLE public.decision_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  family TEXT NOT NULL,
  description TEXT NOT NULL,
  methodology TEXT NOT NULL,
  horizon_months INT NOT NULL DEFAULT 24,
  complexity TEXT NOT NULL DEFAULT 'medium',
  criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  kpi_hints JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_question TEXT NOT NULL,
  recommended_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.decision_templates TO authenticated;
GRANT ALL ON public.decision_templates TO service_role;

ALTER TABLE public.decision_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates readable by authenticated"
  ON public.decision_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Templates manageable by admin"
  ON public.decision_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_decision_templates
  BEFORE UPDATE ON public.decision_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.decision_templates (slug, name, family, description, methodology, horizon_months, complexity, criteria, assumptions, kpi_hints, default_question, recommended_sources, position) VALUES
('make-or-buy', 'Make-or-Buy', 'sourcing', 'Internaliser une capacité vs l''acheter / sous-traiter.', 'Comparaison TCO 5 ans + risques stratégiques + time-to-market + dépendance fournisseur.', 60, 'medium',
 '[{"name":"TCO 5 ans","weight":25},{"name":"Time-to-market","weight":15},{"name":"Contrôle stratégique","weight":20},{"name":"Risque fournisseur","weight":15},{"name":"Flexibilité / scalabilité","weight":15},{"name":"Impact RH / compétences","weight":10}]'::jsonb,
 '["Coût interne pleinement chargé","Coût externe avec inflation contractuelle","Volumes prévisionnels 5 ans","Coût de switching fournisseur"]'::jsonb,
 '[{"name":"TCO 5 ans (M€)"},{"name":"Délai de bascule (mois)"},{"name":"Marge de manœuvre stratégique (1-10)"}]'::jsonb,
 'Faut-il internaliser ou externaliser cette capacité ?',
 '["facts internes coûts","benchmarks marché Firecrawl","indices INSEE coûts du travail"]'::jsonb, 1),

('go-nogo-investissement', 'Go/No-Go investissement', 'capex', 'Lancer ou non un investissement majeur (atelier, plateforme, R&D).', 'VAN + payback + IRR + analyse de sensibilité sur 3 scénarios marché.', 60, 'high',
 '[{"name":"VAN (€)","weight":25},{"name":"Payback (années)","weight":15},{"name":"Alignement stratégique","weight":20},{"name":"Risque exécution","weight":15},{"name":"Impact ESG","weight":10},{"name":"Optionnalité future","weight":15}]'::jsonb,
 '["Capex initial","OPEX additionnel annuel","Revenus incrémentaux 5 ans","Taux d''actualisation (WACC)","Inflation"]'::jsonb,
 '[{"name":"VAN (M€)"},{"name":"IRR (%)"},{"name":"Payback (années)"},{"name":"Sensibilité ±20% revenus"}]'::jsonb,
 'Doit-on lancer cet investissement maintenant, le différer ou y renoncer ?',
 '["facts internes capex/opex","BCE taux directeurs","INSEE inflation","prix commodities marché"]'::jsonb, 2),

('ma-target-screening', 'M&A — Screening cible', 'm-and-a', 'Évaluer et classer des cibles d''acquisition.', 'Scoring multi-critères stratégique + financier + culturel + due diligence légère.', 12, 'high',
 '[{"name":"Fit stratégique","weight":25},{"name":"Multiple EV/EBITDA","weight":15},{"name":"Synergies attendues","weight":20},{"name":"Risque d''intégration","weight":15},{"name":"Qualité management","weight":10},{"name":"Risque concurrence/régulation","weight":15}]'::jsonb,
 '["Multiples sectoriels actuels","Niveau de synergies réalisables (% coûts)","Coût d''intégration","Calendrier closing"]'::jsonb,
 '[{"name":"EV cible (M€)"},{"name":"Synergies an 3 (M€)"},{"name":"Score d''intégration (1-10)"}]'::jsonb,
 'Quelle cible d''acquisition retenir parmi celles évaluées ?',
 '["news M&A Firecrawl","rapports financiers cibles","benchmarks multiples sectoriels"]'::jsonb, 3),

('build-vs-partner', 'Build vs Partner', 'go-to-market', 'Développer en propre, partenariat ou rachat pour entrer sur un marché.', 'Évaluation 3 voies sur vitesse, contrôle, coût et risque.', 36, 'medium',
 '[{"name":"Time-to-revenue","weight":25},{"name":"Coût total","weight":20},{"name":"Contrôle produit/marque","weight":20},{"name":"Risque exécution","weight":15},{"name":"Différenciation marché","weight":20}]'::jsonb,
 '["Délai de mise au marché par voie","Taille marché adressable","Part de marché atteignable an 3"]'::jsonb,
 '[{"name":"Délai go-to-market (mois)"},{"name":"PDM cible an 3 (%)"},{"name":"Investissement total (M€)"}]'::jsonb,
 'Faut-il construire, nous associer ou racheter pour adresser ce marché ?',
 '["études marché Firecrawl","benchmarks concurrents","INSEE/Eurostat dimensionnement"]'::jsonb, 4),

('sizing-capacite', 'Sizing capacité industrielle', 'operations', 'Dimensionner une capacité (atelier, entrepôt, flotte) face à la demande.', 'Projection demande 3 scénarios + analyse goulets + coût d''opportunité sous-/sur-capacité.', 48, 'medium',
 '[{"name":"Couverture demande P90","weight":25},{"name":"Coût unitaire","weight":20},{"name":"Flexibilité (variabilité)","weight":15},{"name":"Délai mise en service","weight":15},{"name":"Empreinte CO₂","weight":10},{"name":"Risque sous-capacité","weight":15}]'::jsonb,
 '["Croissance demande bas/médian/haut","Taux d''utilisation cible","Coût capex / unité de capacité"]'::jsonb,
 '[{"name":"Capacité retenue (unités/an)"},{"name":"Taux d''utilisation cible (%)"},{"name":"Coût unitaire projeté (€)"}]'::jsonb,
 'Quelle capacité dimensionner pour les 4 prochaines années ?',
 '["historique demande interne","INSEE conjoncture sectorielle","Eurostat production industrielle"]'::jsonb, 5),

('pricing-change', 'Changement de prix', 'commercial', 'Augmenter, baisser ou refondre une grille tarifaire.', 'Élasticité prix + impact mix + réaction concurrence + analyse marges.', 12, 'medium',
 '[{"name":"Impact CA","weight":25},{"name":"Impact marge","weight":25},{"name":"Risque churn","weight":20},{"name":"Réaction concurrence","weight":15},{"name":"Perception client","weight":15}]'::jsonb,
 '["Élasticité prix par segment","Position vs concurrence","Capacité à justifier la valeur"]'::jsonb,
 '[{"name":"ΔCA (%)"},{"name":"Δmarge brute (pp)"},{"name":"Churn attendu (%)"}]'::jsonb,
 'Quelle évolution tarifaire appliquer et sur quels segments ?',
 '["prix concurrents Firecrawl","INSEE indices prix","historiques transactions internes"]'::jsonb, 6),

('reduction-opex', 'Plan de réduction OPEX', 'finance', 'Identifier et prioriser les leviers de réduction de coûts.', 'Cartographie coûts + leviers chiffrés + impact opérationnel + risque social.', 24, 'medium',
 '[{"name":"Économies annuelles","weight":30},{"name":"Délai de réalisation","weight":15},{"name":"Risque opérationnel","weight":20},{"name":"Risque social / RH","weight":15},{"name":"Réversibilité","weight":10},{"name":"Impact qualité/client","weight":10}]'::jsonb,
 '["Base de coûts actuelle par poste","Inflation prévisionnelle","Coût de mise en œuvre des leviers"]'::jsonb,
 '[{"name":"Économies an 1 (M€)"},{"name":"Économies récurrentes (M€/an)"},{"name":"Coût de mise en œuvre (M€)"}]'::jsonb,
 'Quels leviers de réduction OPEX prioriser cette année ?',
 '["facts internes coûts","INSEE inflation","BCE prévisions macro"]'::jsonb, 7),

('priorisation-portefeuille', 'Priorisation portefeuille projets', 'portfolio', 'Arbitrer entre N projets candidats avec budget limité.', 'Scoring valeur/effort/risque + contraintes de ressources + dépendances.', 24, 'high',
 '[{"name":"Valeur business","weight":30},{"name":"Alignement stratégique","weight":20},{"name":"Effort / coût","weight":15},{"name":"Risque","weight":15},{"name":"Dépendances","weight":10},{"name":"Time-to-value","weight":10}]'::jsonb,
 '["Enveloppe budgétaire totale","Capacité d''exécution (ETP dispo)","Dépendances inter-projets"]'::jsonb,
 '[{"name":"Valeur agrégée (M€)"},{"name":"Budget consommé (M€)"},{"name":"Nb projets retenus"}]'::jsonb,
 'Quels projets retenir et quels reporter dans l''enveloppe disponible ?',
 '["registre projets interne","OKRs en cours","facts capacité ETP"]'::jsonb, 8);
