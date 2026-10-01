
-- ============================================================
-- LOT 1 — Semantic Contract V2
-- ============================================================
ALTER TABLE public.semantic_objects
  ADD COLUMN IF NOT EXISTS concept text,
  ADD COLUMN IF NOT EXISTS variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS semantic_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS business_meaning text,
  ADD COLUMN IF NOT EXISTS identity_strategy text,
  ADD COLUMN IF NOT EXISTS business_states jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ownership_dimensions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_source_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS freshness text;

ALTER TABLE public.semantic_attributes
  ADD COLUMN IF NOT EXISTS business_meaning text,
  ADD COLUMN IF NOT EXISTS freshness text,
  ADD COLUMN IF NOT EXISTS metric_definition jsonb,
  ADD COLUMN IF NOT EXISTS calculation_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS semantic_role text;

-- ============================================================
-- LOT 1 — Extraction Contract V2
-- ============================================================
ALTER TABLE public.extraction_contracts
  ADD COLUMN IF NOT EXISTS candidate_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_source text,
  ADD COLUMN IF NOT EXISTS confidence_score numeric(4,2),
  ADD COLUMN IF NOT EXISTS transformation_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS refresh_policy text,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending';

-- ============================================================
-- LOT 1 — Facts enrichis
-- ============================================================
ALTER TABLE public.facts
  ADD COLUMN IF NOT EXISTS semantic_role text,
  ADD COLUMN IF NOT EXISTS lineage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS freshness text;

-- ============================================================
-- LOT 1 — Signals enrichis
-- ============================================================
ALTER TABLE public.signals
  ADD COLUMN IF NOT EXISTS contributors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS impacted_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cap_score numeric(4,2);

-- ============================================================
-- LOT 2 — Decision Packs : options + moteurs + outcome
-- ============================================================
ALTER TABLE public.decision_packs
  ADD COLUMN IF NOT EXISTS decision_options jsonb NOT NULL DEFAULT
    '[
      {"key":"do_nothing","label":"Ne rien faire"},
      {"key":"optimize","label":"Optimiser"},
      {"key":"invest","label":"Investir"},
      {"key":"outsource","label":"Externaliser"},
      {"key":"defer","label":"Reporter"},
      {"key":"abandon","label":"Abandonner"}
    ]'::jsonb,
  ADD COLUMN IF NOT EXISTS engines text[] NOT NULL DEFAULT ARRAY['cap','ahp']::text[],
  ADD COLUMN IF NOT EXISTS expected_outcome jsonb,
  ADD COLUMN IF NOT EXISTS observed_outcome jsonb;

-- Active ELECTRE / Pareto / Monte Carlo sur tous les packs strategic
UPDATE public.decision_packs
SET engines = ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[]
WHERE tier = 'strategic';

-- ============================================================
-- LOT 2 — Decision Library : tier/family sur l'existant + seed des manquants
-- ============================================================
-- Tag existing where missing
UPDATE public.decision_packs SET tier = COALESCE(tier,'operational'), family = COALESCE(family,'finance')
  WHERE slug IN ('cash-flow-risk','margin-erosion','pricing');
UPDATE public.decision_packs SET tier = COALESCE(tier,'operational'), family = COALESCE(family,'supply-chain')
  WHERE slug IN ('supplier-risk-universal','stock-availability-risk','forecast-accuracy','supply','delivery-risk','vendor-selection');
UPDATE public.decision_packs SET tier = COALESCE(tier,'tactical'), family = COALESCE(family,'ia-transformation')
  WHERE slug IN ('ai-readiness-universal','ia-readiness','ia-strategy','strategie-ia','business-case','roi-business-case','roadmap-data','application-risk','data-quality-risk','project-risk','build-vs-buy','conformite-ai-act','souverainete-data','risk-compliance');

-- Seed missing packs (idempotent via ON CONFLICT)
INSERT INTO public.decision_packs (slug, title, description, category, icon, tier, family, business_question, decision_question, capabilities, kpis, engines)
VALUES
-- OPERATIONAL
('cash-management','Cash Management','Pilotage quotidien de la trésorerie : positions, prévisions à 13 semaines, arbitrages court terme.','finance','wallet','operational','finance',
  'Avons-nous la trésorerie nécessaire pour tenir nos engagements à 90 jours ?',
  'Quels leviers actionner cette semaine pour sécuriser la trésorerie ?',
  ARRAY['Cash Forecast','Liquidity Buffer']::text[], ARRAY['DSO','DPO','Cash position']::text[], ARRAY['cap','ahp']::text[]),
('revenue-leakage','Revenue Leakage','Détection et récupération des pertes de revenus : remises non autorisées, sous-facturation, fuites contractuelles.','finance','trending-down','operational','finance',
  'Où perdons-nous du revenu sans le voir ?',
  'Quelles fuites prioriser pour récupérer du revenu ce trimestre ?',
  ARRAY['Billing audit','Discount control']::text[], ARRAY['Leakage % revenue','Recovery rate']::text[], ARRAY['cap','ahp']::text[]),
('customer-profitability','Customer Profitability','Rentabilité client réelle (coûts directs, coûts servir, marge nette par segment).','finance','user-check','operational','finance',
  'Quels clients gagnent réellement de l''argent pour nous ?',
  'Quels clients renégocier, prioriser ou abandonner ?',
  ARRAY['Cost-to-serve','Segment profitability']::text[], ARRAY['Net margin per customer']::text[], ARRAY['cap','ahp']::text[]),
('payment-risk','Payment Risk','Risque de défaut et retards de paiement client.','finance','alert-triangle','operational','finance',
  'Quels clients risquent de ne pas payer ?',
  'Quels encours bloquer, escalader ou couvrir ?',
  ARRAY['Credit scoring','Aged receivables']::text[], ARRAY['DSO','Bad debt %']::text[], ARRAY['cap','ahp']::text[]),
('inventory-optimization','Inventory Optimization','Optimisation du stock : couverture, rotation, obsolescence.','supply','package','operational','supply-chain',
  'Notre stock est-il dimensionné au juste niveau ?',
  'Où réduire le stock sans dégrader le service ?',
  ARRAY['Stock turn','Coverage planning']::text[], ARRAY['Stock turn','DIO','Obsolescence %']::text[], ARRAY['cap','ahp']::text[]),
('logistics-performance','Logistics Performance','Performance logistique : délais, coûts, qualité de livraison.','supply','truck','operational','supply-chain',
  'Notre supply chain tient-elle ses promesses ?',
  'Quels flux retravailler en priorité ?',
  ARRAY['On-time delivery','Cost-per-shipment']::text[], ARRAY['OTIF %','Cost/order']::text[], ARRAY['cap','ahp']::text[]),
('promotion-effectiveness','Promotion Effectiveness','Mesure de l''efficacité des promotions et arbitrage du plan promo.','commerce','tag','operational','commerce',
  'Nos promotions créent-elles vraiment de la valeur ?',
  'Quelles promos arrêter, renforcer ou tester ?',
  ARRAY['Promo ROI','Incrementality']::text[], ARRAY['Uplift %','ROI promo']::text[], ARRAY['cap','ahp']::text[]),
('pricing-adjustment','Pricing Adjustment','Ajustements tactiques de prix selon élasticité et concurrence.','commerce','sliders','operational','commerce',
  'Nos prix sont-ils alignés au marché et à la valeur perçue ?',
  'Quels prix revoir maintenant ?',
  ARRAY['Price elasticity','Competitive index']::text[], ARRAY['Margin %','Sell-through']::text[], ARRAY['cap','ahp']::text[]),
('demand-forecast','Demand Forecast','Précision des prévisions de demande à court terme.','commerce','line-chart','operational','commerce',
  'Nos prévisions reflètent-elles la demande réelle ?',
  'Quels segments réajuster cette semaine ?',
  ARRAY['Forecast accuracy','Bias control']::text[], ARRAY['MAPE','Bias %']::text[], ARRAY['cap','ahp']::text[]),

-- TACTICAL
('working-capital-optimization','Working Capital Optimization','Optimisation du BFR (créances, dettes, stocks).','finance','recycle','tactical','finance',
  'Comment libérer du cash piégé dans le BFR ?',
  'Quels leviers BFR activer ce trimestre ?',
  ARRAY['DSO','DPO','DIO']::text[], ARRAY['Cash conversion cycle']::text[], ARRAY['cap','ahp']::text[]),
('margin-management','Margin Management','Pilotage de la marge brute et nette par BU/produit.','finance','percent','tactical','finance',
  'Notre marge est-elle protégée ?',
  'Où agir pour défendre la marge ?',
  ARRAY['Margin bridge','Mix analysis']::text[], ARRAY['Gross margin %','Net margin %']::text[], ARRAY['cap','ahp']::text[]),
('cost-reduction','Cost Reduction','Plan de réduction de coûts : OPEX, achats, structure.','finance','scissors','tactical','finance',
  'Où réduire les coûts sans casser la création de valeur ?',
  'Quels postes attaquer en priorité ?',
  ARRAY['Spend cube','Zero-based budget']::text[], ARRAY['OPEX %','Savings €']::text[], ARRAY['cap','ahp']::text[]),
('assortment-optimization','Assortment Optimization','Rationalisation et optimisation de l''assortiment.','commerce','grid','tactical','commerce',
  'Notre assortiment maximise-t-il la valeur ?',
  'Quels SKU garder, ajouter, retirer ?',
  ARRAY['SKU rationalization']::text[], ARRAY['Sales density','Margin/SKU']::text[], ARRAY['cap','ahp']::text[]),
('omnichannel-optimization','Omnichannel Optimization','Cohérence et performance omnicanale.','commerce','network','tactical','commerce',
  'Notre omnicanal sert-il vraiment le client ?',
  'Quels parcours ou points de contact améliorer ?',
  ARRAY['Channel mix','Customer journey']::text[], ARRAY['Conversion %','NPS']::text[], ARRAY['cap','ahp']::text[]),
('store-performance','Store Performance','Performance commerciale magasin.','commerce','store','tactical','retail',
  'Quels magasins sous-performent et pourquoi ?',
  'Quels plans d''action par magasin ?',
  ARRAY['Sales per sqm','Traffic conversion']::text[], ARRAY['Like-for-like %','Margin €/sqm']::text[], ARRAY['cap','ahp']::text[]),
('agent-opportunity-discovery','Agent Opportunity Discovery','Identification des opportunités d''agents IA dans les processus.','ia','cpu','tactical','ia-transformation',
  'Où des agents IA créeraient le plus de valeur ?',
  'Quels cas d''usage agentic lancer en premier ?',
  ARRAY['Process mining','Use case scoring']::text[], ARRAY['Hours saved','Value €']::text[], ARRAY['cap','ahp']::text[]),
('application-rationalization','Application Rationalization','Rationalisation du portefeuille applicatif.','ia','layers','tactical','ia-transformation',
  'Notre portefeuille applicatif est-il sain ?',
  'Quelles applications décommissionner, fusionner, garder ?',
  ARRAY['App TIME analysis','Redundancy mapping']::text[], ARRAY['Apps count','TCO']::text[], ARRAY['cap','ahp']::text[]),
('technical-debt-exposure','Technical Debt Exposure','Exposition au risque de dette technique.','ia','bug','tactical','ia-transformation',
  'Notre dette technique nous met-elle en risque ?',
  'Quels chantiers de remédiation prioriser ?',
  ARRAY['Tech debt scoring']::text[], ARRAY['Debt index','MTTR']::text[], ARRAY['cap','ahp']::text[]),

-- STRATEGIC
('store-expansion','Store Expansion','Ouverture de nouveaux points de vente.','strategy','map-pin','strategic','growth',
  'Faut-il ouvrir de nouveaux magasins, où et quand ?',
  'Quelles villes / formats prioriser ?',
  ARRAY['Catchment analysis','Format mix']::text[], ARRAY['Payback period','ROI']::text[], ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[]),
('collection-investment','Collection Investment','Investissement dans une nouvelle collection / gamme.','strategy','sparkles','strategic','growth',
  'Cette collection mérite-t-elle l''investissement ?',
  'Quel scope et quel budget allouer ?',
  ARRAY['Collection ROI']::text[], ARRAY['Sell-through','Margin']::text[], ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[]),
('transformation-portfolio','Transformation Portfolio','Arbitrage du portefeuille de transformation.','strategy','briefcase','strategic','transformation',
  'Notre portefeuille de transformation crée-t-il vraiment de la valeur ?',
  'Quels programmes accélérer, arrêter, fusionner ?',
  ARRAY['Portfolio scoring']::text[], ARRAY['NPV','Strategic fit']::text[], ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[]),
('erp-transformation','ERP Transformation','Transformation / changement d''ERP.','strategy','database','strategic','transformation',
  'Devons-nous transformer notre ERP, comment et avec qui ?',
  'Big bang, par lots ou status quo ?',
  ARRAY['ERP roadmap']::text[], ARRAY['TCO','Time-to-value']::text[], ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[]),
('platform-strategy','Platform Strategy','Choix de plateformes structurantes (data, cloud, IA).','strategy','server','strategic','transformation',
  'Quelle stratégie de plateformes adopter ?',
  'Quels socles consolider, lesquels remplacer ?',
  ARRAY['Platform TIME','Vendor analysis']::text[], ARRAY['TCO','Lock-in risk']::text[], ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[]),
('build-buy-partner-strategic','Build / Buy / Partner','Arbitrage stratégique build vs buy vs partner.','strategy','git-branch','strategic','transformation',
  'Faut-il construire, acheter ou s''associer ?',
  'Quel mode d''accès à la capacité retenir ?',
  ARRAY['BBP scoring']::text[], ARRAY['TCO','Speed','Strategic control']::text[], ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[]),
('ma-evaluation','M&A Evaluation','Évaluation de cibles M&A.','strategy','handshake','strategic','transformation',
  'Cette acquisition crée-t-elle de la valeur ?',
  'Acheter, structurer un partenariat ou passer ?',
  ARRAY['Target screening','Synergy modeling']::text[], ARRAY['EV/EBITDA','Synergies €']::text[], ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[]),
('outsourcing-strategy','Outsourcing Strategy','Stratégie d''externalisation de fonctions / processus.','strategy','external-link','strategic','transformation',
  'Quelles fonctions externaliser ?',
  'Quel modèle d''externalisation et chez qui ?',
  ARRAY['Make vs buy','Vendor scorecard']::text[], ARRAY['TCO','Service level']::text[], ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[]),
('new-business-model','New Business Model','Exploration de nouveaux modèles d''affaires.','strategy','rocket','strategic','growth',
  'Devons-nous lancer un nouveau business model ?',
  'Tester, scaler, partenariat ou abandonner ?',
  ARRAY['Business model canvas']::text[], ARRAY['NPV','Time-to-revenue']::text[], ARRAY['cap','ahp','electre','pareto','monte_carlo']::text[])
ON CONFLICT (slug) DO UPDATE SET
  tier = EXCLUDED.tier,
  family = EXCLUDED.family,
  business_question = COALESCE(public.decision_packs.business_question, EXCLUDED.business_question),
  decision_question = COALESCE(public.decision_packs.decision_question, EXCLUDED.decision_question),
  engines = EXCLUDED.engines;
