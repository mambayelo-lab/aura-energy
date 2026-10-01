
CREATE TABLE IF NOT EXISTS public.interview_question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  dimension text NOT NULL,
  question text NOT NULL,
  hint text,
  ord integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interview_question_bank TO authenticated, anon;
GRANT ALL ON public.interview_question_bank TO service_role;
ALTER TABLE public.interview_question_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qb_read_all" ON public.interview_question_bank FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "qb_admin_write" ON public.interview_question_bank
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.interview_question_bank (role, dimension, question, hint, ord) VALUES
('CDO','data','Cartographie des sources de données critiques : à jour ? gouvernées ?','Demander un schéma data lineage récent', 1),
('CDO','data','Quel pourcentage de vos données métier dispose d''un owner identifié ?','Owner = responsable nommé', 2),
('CDO','data','Quelle est la fraîcheur moyenne des Golden Records (client, produit) ?','Comparer SLA vs réalité', 3),
('CDO','data','Quels jeux de données seraient bloquants pour entraîner un modèle ?','Cible : Top 5', 4),
('CDO','data','Avez-vous des Data Products consommables en self-service ?','API / vues exposées', 5),
('CDO','data','Quels indicateurs de qualité (DQ) suivez-vous au quotidien ?','Complétude, fraîcheur, unicité', 6),

('DSI','architecture','Décrivez votre stack cloud / on-prem et les zones d''ombre.','Diagramme à demander', 1),
('DSI','architecture','MLOps : avez-vous un pipeline reproductible de la donnée au modèle déployé ?','CI/CD, monitoring drift', 2),
('DSI','architecture','Vos systèmes critiques exposent-ils des APIs documentées (OpenAPI) ?','Cible >80%', 3),
('DSI','architecture','Combien d''applications obsolètes (>10 ans) restent en production ?','Risque tech debt', 4),
('DSI','architecture','Quelle est votre capacité d''intégration en temps réel (event streaming) ?','Kafka, Pub/Sub, etc.', 5),
('DSI','architecture','Quels environnements (dev/preprod/prod) sont iso ?','Reproductibilité', 6),

('RSSI','cybersecurity','Quel est votre niveau de conformité AI Act (Annexe III, GPAI) ?','Inventaire des cas d''usage à risque', 1),
('RSSI','cybersecurity','Comment gérez-vous les secrets et clés d''API des modèles ?','KMS, rotation, audit', 2),
('RSSI','cybersecurity','Avez-vous une politique de Red Team / évaluation adversariale des modèles ?','Prompt injection, jailbreak', 3),
('RSSI','cybersecurity','Comment tracez-vous les accès aux données personnelles utilisées pour entraîner ?','RGPD, DPIA', 4),
('RSSI','cybersecurity','Plan de réponse à incident IA (hallucination, fuite) : formalisé ?','PCA/PRA spécifique IA', 5),
('RSSI','cybersecurity','Vos fournisseurs IA tiers ont-ils été audités (souveraineté, localisation) ?','Cloud Act, SecNumCloud', 6),

('Métier','talent','Quelles compétences IA manquent le plus dans votre équipe ?','Top 3', 1),
('Métier','talent','Quel pourcentage de vos collaborateurs utilise un outil IA générative au quotidien ?','Adoption réelle', 2),
('Métier','talent','Quels sont les freins culturels à l''adoption de l''IA dans votre périmètre ?','Crainte, formation, sens', 3),
('Métier','talent','Comment mesurez-vous l''impact d''un cas d''usage IA sur la productivité ?','KPIs business', 4),
('Métier','talent','Avez-vous un sponsor exécutif clairement identifié pour l''IA ?','Sponsorship', 5),
('Métier','talent','Quelle gouvernance pour arbitrer un nouveau cas d''usage IA ?','Comité, critères', 6);

-- Ensure 4 canonical dimensions exist for every mission
INSERT INTO public.ia_readiness_dimensions (mission_id, dimension, label, score, maturity_level, observations, ord)
SELECT m.id, x.dim, x.label, x.score, x.maturity, x.obs, x.ord
FROM public.missions m
CROSS JOIN (VALUES
  ('cybersecurity','Cybersécurité & conformité', 45, 'Initial', 'Politique IA Act en cours, peu d''audits adversariaux.', 9),
  ('architecture','Architecture & plateforme', 55, 'En cours', 'Cloud partiel, MLOps émergent, APIs documentées <60%.', 10)
) AS x(dim, label, score, maturity, obs, ord)
ON CONFLICT (mission_id, dimension) DO NOTHING;
