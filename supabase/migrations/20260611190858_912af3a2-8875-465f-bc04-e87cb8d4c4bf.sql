-- Fix: grant EXECUTE on has_role to authenticated/anon so RLS policies using it stop returning "permission denied"
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- Seed Decision Packs (idempotent via ON CONFLICT on slug)
INSERT INTO public.decision_packs (slug, title, category, description, icon, is_published) VALUES
  ('strategie-ia',     'Stratégie IA',         'Cadrage',     'Cadrer la vision IA, le budget cible et les OKR exécutifs. Aura structure ambition, ressources et trajectoire.', 'compass',  true),
  ('build-vs-buy',     'Build vs Buy',         'Architecture','Choisir entre développement interne, éditeur ou hybride sur une capacité IA. Critères TCO, time-to-value, dépendance.', 'layers',   true),
  ('business-case',    'Business Case IA',     'Valeur',      'Chiffrer l''impact d''un cas d''usage : ROI 12 mois, hypothèses, sensibilité, conditions de succès.', 'trending-up','true'::boolean),
  ('pricing',          'Pricing & Marge',      'Commerce',    'Aligner stratégie prix multi-canal (boutique, e-com, marketplace) en préservant la perception premium.', 'tag',      true),
  ('conformite-ai-act','Conformité AI Act',    'Gouvernance', 'Cadrer le risque par cas d''usage, le registre interne et les obligations vis-à-vis du régulateur 2026-2027.', 'shield-check', true),
  ('souverainete-data','Souveraineté Data',    'Cyber',       'Évaluer dépendances cloud, exposition Cloud Act, options de relocalisation pour les domaines sensibles.', 'globe',    true),
  ('ia-readiness',     'IA Readiness Express', 'Diagnostic',  'Auto-diagnostic rapide sur 8 dimensions (stratégie, données, archi, cyber, compétences, gouv., FinOps, adoption).', 'gauge', true),
  ('roadmap-data',     'Roadmap Data 9 mois',  'Exécution',   'Prioriser les chantiers data (qualité, ontologie, lineage) qui débloquent les cas d''usage IA face client.', 'gantt-chart', true)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_published = EXCLUDED.is_published;