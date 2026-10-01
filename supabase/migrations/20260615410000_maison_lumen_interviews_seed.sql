-- Seed: Interviews de cadrage – Maison Lumen
-- Mission ID: 11111111-1111-1111-1111-111111111111
-- Ce seed s'exécute uniquement si la mission existe (créée via seedMaisonLumenComplete)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM missions WHERE id = '11111111-1111-1111-1111-111111111111') THEN
    RAISE NOTICE 'Mission Maison Lumen introuvable – seed interviews ignoré.';
    RETURN;
  END IF;

  -- Supprimer les interviews existantes pour idempotence
  DELETE FROM mission_interviews WHERE mission_id = '11111111-1111-1111-1111-111111111111';

  INSERT INTO mission_interviews (
    id, mission_id, interviewee_name, interviewee_role, interviewee_department,
    interview_date, duration_min, channel, summary, transcript,
    key_verbatims, pain_points, opportunities, apps_mentioned
  ) VALUES

  -- 1. DSI
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'Laurent Ferré',
    'Directeur des Systèmes d''Information',
    'DSI',
    '2026-05-12',
    90,
    'visio',
    'Laurent décrit un SI hétérogène : SAP S/4HANA pour la gestion centrale, Cegid pour les 14 boutiques, Shopify pour le web et un OMS Manhattan qui ne communique pas en temps réel avec SAP. Les écarts de stock entre canaux génèrent des pertes estimées à 3 M€/an. Le projet d''unification est bloqué par des budgets figés et la résistance des équipes métier.',
    'Aura: Quels sont vos principaux défis SI aujourd''hui ? Laurent: On a 6 systèmes qui ne parlent pas vraiment entre eux. SAP est notre ERP de référence mais les boutiques tournent sur Cegid et les données remontent avec J+1 de délai. Aura: Quel est l''impact ? Laurent: On estime 3 millions d''euros de stock manquant ou mal alloué par an. Les commerciaux vendent ce qu''on n''a pas en stock quelque part. Aura: Vous avez un projet en cours ? Laurent: On a commencé une réflexion avec Manhattan pour une couche OMS unifiée mais c''est complexe. Et budgétairement c''est difficile à justifier sans chiffrer l''impact précisément.',
    '[
      {"verbatim": "On a 6 systèmes qui ne parlent pas entre eux — chaque silo génère des angles morts.", "theme": "fragmentation_SI"},
      {"verbatim": "3 millions d''euros de stock mal alloué par an — c''est notre estimation conservatrice.", "theme": "perte_stock"},
      {"verbatim": "Le décideur métier ne fait pas confiance aux chiffres SAP parce qu''ils arrivent trop tard.", "theme": "qualite_donnees"},
      {"verbatim": "Manhattan OMS est notre priorité mais on n''arrive pas à en calculer le ROI.", "theme": "projet_bloque"}
    ]'::jsonb,
    '[
      {"pain": "Délai J+1 sur remontées Cegid → décisions stock prises sur données périmées", "severity": "high"},
      {"pain": "Absence de vision unifiée stock cross-canal (SAP + Cegid + Shopify)", "severity": "critical"},
      {"pain": "Manque de confiance des métiers dans les données de référence", "severity": "medium"},
      {"pain": "Pas de calcul ROI pour prioriser les projets SI", "severity": "medium"}
    ]'::jsonb,
    '[
      {"opportunity": "Couche d''agrégation temps réel entre SAP, Cegid et Shopify via API", "effort": "medium"},
      {"opportunity": "Dashboard décisionnel stock cross-canal pour les buyers", "effort": "low"},
      {"opportunity": "Alertes automatiques sur ruptures imminentes", "effort": "low"}
    ]'::jsonb,
    ARRAY['SAP S/4HANA', 'Cegid POS', 'Shopify Plus', 'Manhattan OMS', 'PowerBI']
  ),

  -- 2. Directrice Supply Chain
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'Sophie Marchand',
    'Directrice Supply Chain',
    'Supply Chain',
    '2026-05-14',
    75,
    'onsite',
    'Sophie gère les approvisionnements pour 180 références actives. Elle passe 2h/jour à consolider manuellement des fichiers Excel issus de SAP et Cegid pour piloter les réassorts. Les délais fournisseurs ont augmenté de 40% depuis 2024 (délocalisation partielle vers Europe) et elle manque d''outils de prévision fine par canal. Les ruptures web sont son obsession : -18% de conversion quand un produit passe en "rupture imminente".',
    'Aura: Comment vous pilotez les réassorts aujourd''hui ? Sophie: J''ai un fichier Excel que je consolide chaque matin avec les exports SAP et Cegid. Ça prend 2 heures minimum. Aura: Qu''est-ce qui vous manque ? Sophie: Une vue en temps réel par produit, par canal, par zone géographique. Et surtout des alertes avant la rupture, pas après. Aura: Les délais fournisseurs ? Sophie: On a relocalisé une partie de notre production vers l''Europe — c''est bien pour l''éthique mais les délais sont passés de 6 à 12 semaines pour certains fournisseurs. Ça change complètement nos règles de réassort. Aura: Et la prévision ? Sophie: o9 fait de la prévision mais on ne l''alimente pas assez bien. Les données Shopify et Cegid ne remontent pas automatiquement dans o9. C''est un problème.',
    '[
      {"verbatim": "Je passe 2 heures par matin sur Excel pour avoir ce que devrait me donner mon SI en 30 secondes.", "theme": "temps_perdu_consolidation"},
      {"verbatim": "Une rupture web ça nous coûte -18% de conversion sur la gamme entière.", "theme": "impact_rupture"},
      {"verbatim": "Les délais fournisseurs ont doublé — mes règles de sécurité stock ne sont plus calibrées.", "theme": "risque_fournisseur"},
      {"verbatim": "o9 est sous-utilisé parce qu''on ne l''alimente pas correctement.", "theme": "sous_utilisation_outils"}
    ]'::jsonb,
    '[
      {"pain": "Consolidation manuelle Excel quotidienne — 2h/jour perdues", "severity": "high"},
      {"pain": "Absence d''alertes proactives avant rupture (détection post-rupture seulement)", "severity": "critical"},
      {"pain": "Délais fournisseurs en forte hausse non intégrés dans les règles de réassort", "severity": "high"},
      {"pain": "o9/JDA sous-alimenté — prévisions peu fiables", "severity": "medium"},
      {"pain": "Pas de vision stock par canal (web vs boutique) en temps réel", "severity": "high"}
    ]'::jsonb,
    '[
      {"opportunity": "Automatisation de la consolidation stock cross-canal vers un dashboard temps réel", "effort": "medium"},
      {"opportunity": "Alertes rupture imminente J-7 avec recommandation de réassort", "effort": "low"},
      {"opportunity": "Recalibrage des seuils de sécurité stock selon délais fournisseurs actuels", "effort": "low"},
      {"opportunity": "Alimentation automatique de o9 depuis Shopify + Cegid", "effort": "high"}
    ]'::jsonb,
    ARRAY['SAP S/4HANA', 'Cegid POS', 'Shopify Plus', 'o9/JDA', 'Excel', 'Manhattan WMS']
  ),

  -- 3. Directeur Commercial
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'Thomas Vidal',
    'Directeur Commercial',
    'Commerce',
    '2026-05-15',
    60,
    'onsite',
    'Thomas dirige une équipe de 28 conseillers de vente répartis sur 14 boutiques. Son KPI prioritaire est le taux de transformation en boutique (actuellement 34%, cible 42%). Il souffre de l''absence de remontée CRM depuis les boutiques — Salesforce est utilisé uniquement par les commerciaux grands comptes. Les conseillers de vente ne savent pas qu''un client web a déjà visité 3 fois avant de venir en boutique.',
    'Aura: Quel est votre principal levier de croissance ? Thomas: La fidélisation. Un client qui achète 3 fois dépense 4x plus qu''un primo-acheteur. Mais je n''ai pas de vue cross-canal sur le parcours client. Aura: Concrètement ? Thomas: Une cliente peut être venue sur Shopify, avoir ajouté au panier, abandonné, reçu un email de relance, puis venir en boutique. Mon conseiller ne sait rien de tout ça. Il l''accueille comme une inconnue. Aura: Et le CRM ? Thomas: Salesforce c''est pour les grands comptes B2B. En boutique on n''a rien — juste les cartes de fidélité mais elles ne remontent pas dans Salesforce. Aura: Impact chiffré ? Thomas: Si on remonte même 20% des visites boutique dans le CRM et qu''on les connecte au parcours web, j''estime +8% de transformation.',
    '[
      {"verbatim": "Un client fidèle dépense 4x plus — et je ne sais pas qui il est quand il pousse ma porte.", "theme": "connaissance_client"},
      {"verbatim": "Salesforce c''est pour le B2B, pas pour mes conseillers de vente.", "theme": "outils_inadaptes"},
      {"verbatim": "+8% de transformation si on connecte le parcours web au comportement boutique.", "theme": "opportunite_cross_canal"},
      {"verbatim": "Je pilote avec des rapports hebdomadaires — je découvre les problèmes une semaine après.", "theme": "manque_temps_reel"}
    ]'::jsonb,
    '[
      {"pain": "Absence de vision cross-canal du parcours client (web + boutique)", "severity": "critical"},
      {"pain": "Conseillers de vente sans contexte client à l''accueil en boutique", "severity": "high"},
      {"pain": "CRM (Salesforce) non utilisé en retail — silot B2B/B2C", "severity": "high"},
      {"pain": "Pilotage hebdomadaire — pas de détection d''anomalie en temps réel", "severity": "medium"}
    ]'::jsonb,
    '[
      {"opportunity": "Unification identité client web + boutique via email/carte fidélité", "effort": "medium"},
      {"opportunity": "Fiche client cross-canal accessible aux conseillers de vente en boutique", "effort": "medium"},
      {"opportunity": "Alertes sur segments à risque de churn (inactifs 60j)", "effort": "low"},
      {"opportunity": "Dashboard taux de transformation temps réel par boutique", "effort": "low"}
    ]'::jsonb,
    ARRAY['Salesforce CRM', 'Cegid POS', 'Shopify Plus', 'Excel']
  ),

  -- 4. Directrice Marketing
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'Camille Aubert',
    'Directrice Marketing & E-commerce',
    'Marketing',
    '2026-05-16',
    65,
    'visio',
    'Camille pilote les campagnes digitales et l''e-commerce. Son taux de conversion web actuel est de 2.1% (benchmark secteur : 3.4%). Elle attribue cela à une mauvaise synchronisation des stocks sur Shopify : les clients voient des produits disponibles qui sont en réalité en rupture en entrepôt, ou inversement ne voient pas de produits disponibles en boutique. Elle dépense 180k€/an en Google Ads avec un ROAS de 3.2 alors que la cible est 5.',
    'Aura: Votre taux de conversion web, comment vous l''analysez ? Camille: 2.1% c''est trop bas. Le benchmark est à 3.4% dans notre secteur. Aura: D''où vient l''écart ? Camille: En grande partie du stock. On affiche des produits en rupture ou on cache des produits disponibles ailleurs. Le moteur de stock Shopify ne reçoit pas les vraies données en temps réel. Aura: Votre budget acquisition ? Camille: 180k€ en Google Ads. ROAS de 3.2 alors qu''on vise 5. Mais une partie du problème c''est qu''on envoie des gens sur des pages produit en rupture. Aura: Vous avez des données Salesforce sur les clients e-commerce ? Camille: Non, Salesforce n''est pas connecté à Shopify. Je travaille avec Google Analytics et les exports Shopify. C''est très silotté.',
    '[
      {"verbatim": "2.1% de conversion alors que le benchmark est à 3.4% — l''écart se chiffre en millions.", "theme": "conversion_insuffisante"},
      {"verbatim": "On pousse du budget Google Ads vers des pages produit en rupture — c''est de l''argent brûlé.", "theme": "inefficacite_acquisition"},
      {"verbatim": "Le stock Shopify n''est pas le vrai stock — c''est notre plus gros problème e-commerce.", "theme": "fiabilite_stock_web"},
      {"verbatim": "Je n''ai aucune vue sur ce que font mes clients e-commerce en boutique.", "theme": "angle_mort_cross_canal"}
    ]'::jsonb,
    '[
      {"pain": "Stock Shopify désynchronisé — affichage disponibilité incorrect", "severity": "critical"},
      {"pain": "Budget Google Ads gaspillé sur des pages produit en rupture réelle", "severity": "high"},
      {"pain": "ROAS 3.2 vs cible 5 — sous-performance acquisition", "severity": "high"},
      {"pain": "Aucune connexion Salesforce ↔ Shopify — angle mort client", "severity": "medium"},
      {"pain": "Taux conversion 2.1% vs benchmark 3.4% — manque à gagner estimé", "severity": "high"}
    ]'::jsonb,
    '[
      {"opportunity": "Synchronisation stock temps réel SAP → Shopify (< 5 min)", "effort": "medium"},
      {"opportunity": "Exclusion automatique des produits en rupture des campagnes Google Ads", "effort": "low"},
      {"opportunity": "Segmentation clients e-commerce pour personnalisation des offres", "effort": "medium"},
      {"opportunity": "Attribution cross-canal web → boutique pour mesurer le vrai ROI digital", "effort": "high"}
    ]'::jsonb,
    ARRAY['Shopify Plus', 'Salesforce CRM', 'Google Analytics', 'Google Ads', 'SAP S/4HANA']
  ),

  -- 5. DAF
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'Pierre Blanchard',
    'Directeur Administratif et Financier',
    'Finance',
    '2026-05-19',
    55,
    'onsite',
    'Pierre supervise la clôture mensuelle et les prévisions de trésorerie. Son irritant principal : le processus de clôture prend 8 jours ouvrés car les données opérationnelles (ventes, stock, achats) doivent être rapprochées manuellement depuis 4 systèmes différents. Il souhaite passer à une clôture en 3 jours. Par ailleurs, le niveau de stock (valeur comptable 4.2 M€) lui semble trop élevé par rapport aux rotations réelles.',
    'Aura: Votre processus de clôture mensuelle ? Pierre: 8 jours ouvrés. C''est trop. Le CA fait une clôture en 5 jours, certains concurrents en 3. Aura: D''où vient la lenteur ? Pierre: On rapproche manuellement SAP, Cegid et Shopify. Chaque système a son référentiel produit. Les codes articles ne correspondent pas toujours. Aura: Le stock au bilan ? Pierre: 4.2 millions d''euros de valeur comptable. Le taux de rotation est de 3.2 — pour une enseigne comme nous ça devrait être entre 5 et 7. Aura: Vous visualisez bien quels produits tournent mal ? Pierre: Non, c''est le problème. SAP donne les valorisations mais pas la vue canal. Certains produits dormants en boutique sont peut-être actifs sur le web. Je ne sais pas.',
    '[
      {"verbatim": "8 jours de clôture alors que le standard marché est 3 — c''est un signe de maturité SI insuffisante.", "theme": "cloture_lente"},
      {"verbatim": "4.2 millions de stock pour un taux de rotation de 3.2 — il y a de la valeur dormante.", "theme": "stock_dormant"},
      {"verbatim": "Les codes articles ne correspondent pas entre SAP et Cegid — chaque rapprochement est une négociation.", "theme": "referentiel_produit"},
      {"verbatim": "Je ne sais pas quels produits dormants en boutique pourraient se vendre sur le web.", "theme": "opportunite_destock"}
    ]'::jsonb,
    '[
      {"pain": "Clôture mensuelle en 8 jours — trop longue, processus manuel", "severity": "high"},
      {"pain": "Taux de rotation stock 3.2 vs benchmark 5-7 — immobilisation de trésorerie", "severity": "high"},
      {"pain": "Référentiels produit incohérents entre SAP, Cegid et Shopify", "severity": "medium"},
      {"pain": "Absence de vue analytique stock par canal pour déstockage ciblé", "severity": "medium"}
    ]'::jsonb,
    '[
      {"opportunity": "Référentiel produit unifié cross-SI pour accélérer les rapprochements", "effort": "high"},
      {"opportunity": "Dashboard rotation stock par référence et canal pour identifier les dormants", "effort": "medium"},
      {"opportunity": "Prévision de trésorerie basée sur données ventes temps réel", "effort": "medium"},
      {"opportunity": "Automatisation des réconciliations comptables inter-SI", "effort": "high"}
    ]'::jsonb,
    ARRAY['SAP S/4HANA', 'Cegid POS', 'Shopify Plus', 'Excel', 'SAP Analytics Cloud']
  ),

  -- 6. DRH
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'Nathalie Costa',
    'Directrice des Ressources Humaines',
    'RH',
    '2026-05-20',
    50,
    'visio',
    'Nathalie gère 340 collaborateurs dont 260 en boutique. Son principal défi : l''optimisation des plannings en boutique en fonction du flux client. Aujourd''hui les plannings sont faits à la semaine sans données prévisionnelles. Les boutiques sous-staffées génèrent des pertes de ventes estimées à 15% sur les pics non anticipés. Elle souhaite un outil qui connecte prévisions de trafic et planification RH.',
    'Aura: Comment vous planifiez les équipes en boutique ? Nathalie: On fait les plannings à la semaine. Les managers utilisent leur intuition et les données de la semaine précédente. Aura: Vous avez accès aux données de trafic ? Nathalie: Non, c''est siloté. Le trafic boutique est mesuré par des compteurs mais ces données ne remontent pas à notre outil de planning. Aura: Impact ? Nathalie: On estime 15% de perte de ventes sur les pics non anticipés — Noël, soldes, mais aussi des pics liés à des événements locaux. Aura: Et le turnover ? Nathalie: 28% en boutique — c''est notre vraie plaie. Beaucoup lié à des plannings perçus comme injustes ou peu prévisibles.',
    '[
      {"verbatim": "Les plannings sont faits à l''intuition — et ça se voit dans les résultats les jours de pic.", "theme": "planning_empirique"},
      {"verbatim": "15% de perte de ventes sur les pics non anticipés — c''est direct dans le CA.", "theme": "impact_sous_staffing"},
      {"verbatim": "28% de turnover en boutique — souvent lié à la perception d''injustice des plannings.", "theme": "turnover_elevé"},
      {"verbatim": "Les données de trafic compteurs ne remontent pas à notre outil RH.", "theme": "silo_donnees_rh"}
    ]'::jsonb,
    '[
      {"pain": "Planification RH déconnectée des données de trafic prévisionnelles", "severity": "high"},
      {"pain": "Sous-staffing sur pics = 15% de pertes de ventes estimées", "severity": "high"},
      {"pain": "Turnover 28% en boutique — coût de recrutement/formation élevé", "severity": "medium"},
      {"pain": "Absence d''outil de pilotage RH connecté aux données métier", "severity": "medium"}
    ]'::jsonb,
    '[
      {"opportunity": "Connexion prévisions de trafic → recommandations de staffing par boutique", "effort": "medium"},
      {"opportunity": "Alertes sur risques de sous-staffing J-7", "effort": "low"},
      {"opportunity": "Tableau de bord équité des plannings pour réduire le turnover perçu", "effort": "low"}
    ]'::jsonb,
    ARRAY['Cegid POS', 'Excel', 'o9/JDA']
  ),

  -- 7. Responsable SI / Intégration
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'Jean-Luc Moreau',
    'Responsable Architecture SI & Intégration',
    'DSI',
    '2026-05-21',
    80,
    'onsite',
    'Jean-Luc est le garant de l''architecture technique. Il a cartographié 23 interfaces entre les 6 systèmes — dont 14 via des flux batch nocturnes fragiles. Deux incidents majeurs en 2025 ont bloqué les ventes web pendant respectivement 4h et 7h. Il est favorable à une architecture événementielle mais n''a pas les ressources pour mener ce chantier. Il a identifié les APIs REST disponibles sur chaque système et est prêt à les exposer.',
    'Aura: Comment sont connectés vos systèmes aujourd''hui ? Jean-Luc: 23 interfaces. La plupart en batch nocturne — des fichiers plats, parfois du FTP. C''est fragile. Aura: Des incidents récents ? Jean-Luc: Deux incidents en 2025 — l''un a bloqué Shopify 4 heures, l''autre 7 heures. Origine : flux batch SAP → Shopify tombé sans alerting. Aura: Vous avez des APIs ? Jean-Luc: Oui, tous nos systèmes ont des APIs REST. SAP Odata, Cegid a une API commerce, Shopify native, Manhattan aussi. Le problème c''est qu''on n''a pas de couche ESB ou middleware pour les orchestrer. On a regardé MuleSoft mais c''est trop cher. Aura: Votre vision cible ? Jean-Luc: Event-driven avec Kafka ou un bus interne. Mais c''est 18 mois de projet. Ce dont on a besoin maintenant c''est d''une couche de lecture unifiée qui consomme les APIs sans refaire l''architecture.',
    '[
      {"verbatim": "23 interfaces, 14 en batch nocturne — chaque nuit c''est une course contre la montre.", "theme": "fragilite_architecture"},
      {"verbatim": "7 heures de Shopify down en 2025 à cause d''un batch silencieux.", "theme": "incidents_production"},
      {"verbatim": "Tous nos systèmes ont des APIs REST — personne ne les consomme de façon centralisée.", "theme": "api_sous_utilisees"},
      {"verbatim": "On a besoin d''une couche de lecture unifiée sans refaire toute l''architecture.", "theme": "besoin_agregation"}
    ]'::jsonb,
    '[
      {"pain": "Architecture batch nocturne fragile — 2 incidents majeurs en 2025", "severity": "critical"},
      {"pain": "Absence d''alerting sur les flux d''intégration", "severity": "high"},
      {"pain": "Pas de middleware d''orchestration API", "severity": "high"},
      {"pain": "Vision temps réel impossible sans refonte coûteuse", "severity": "medium"}
    ]'::jsonb,
    '[
      {"opportunity": "Couche de lecture API unifiée (pattern read-model) sans refonte architecture", "effort": "medium"},
      {"opportunity": "Monitoring et alerting des flux d''intégration existants", "effort": "low"},
      {"opportunity": "Remplacement progressif des batchs critiques par des appels API synchrones", "effort": "high"}
    ]'::jsonb,
    ARRAY['SAP S/4HANA', 'Cegid POS', 'Shopify Plus', 'Manhattan OMS', 'o9/JDA', 'Salesforce CRM']
  ),

  -- 8. Chef de projet digital
  (
    gen_random_uuid(),
    '11111111-1111-1111-1111-111111111111',
    'Alix Perrin',
    'Chef de projet Digital & Data',
    'Digital',
    '2026-05-22',
    60,
    'visio',
    'Alix coordonne les projets transverses data et digital. Elle est la première à avoir demandé une couche décisionnelle unifiée. Elle pilote actuellement 3 projets en parallèle (refonte Shopify, migration CRM, intégration o9) sans vision consolidée de l''avancement ni des dépendances. Elle manque d''un outil de suivi des décisions prises et de leur résultat.',
    'Aura: Vous pilotez combien de projets en ce moment ? Alix: Officiellement 3, officieusement 7. La refonte Shopify, la migration CRM, l''intégration o9, le projet Manhattan, la BI, le RGPD data et un projet d''appli mobile. Aura: Comment vous suivez les décisions prises en comité ? Alix: Avec un Confluence et un Excel de suivi. Mais les décisions prises en comité de direction ne sont pas toujours tracées. On découvre 3 mois après qu''on a pris des décisions contradictoires. Aura: Ce que vous voudriez ? Alix: Un outil qui me dit : voici les décisions ouvertes, voici leur impact estimé, voici ce qui a été décidé et pourquoi. Et surtout ce qui s''est passé après — est-ce que la décision a produit les effets attendus ? Aura: Une décision récente qui illustre le problème ? Alix: On a décidé de migrer vers Shopify Markets pour l''international. 6 mois après, personne ne peut me dire si ça a amélioré le taux de conversion sur les marchés cibles.',
    '[
      {"verbatim": "On prend des décisions en comité de direction qui ne sont pas tracées — on les redécouvre 3 mois après.", "theme": "absence_tracabilite_decisions"},
      {"verbatim": "Je veux savoir : est-ce que la décision a produit les effets attendus ?", "theme": "mesure_impact_decisions"},
      {"verbatim": "7 projets en parallèle sans vue consolidée des dépendances.", "theme": "charge_projet"},
      {"verbatim": "La migration Shopify Markets — 6 mois après, personne ne peut me dire si c''est un succès.", "theme": "decision_sans_resultat"}
    ]'::jsonb,
    '[
      {"pain": "Décisions de comité de direction non tracées — perte de contexte et cohérence", "severity": "high"},
      {"pain": "Absence de suivi de l''impact des décisions prises", "severity": "critical"},
      {"pain": "Surcharge projets — 7 projets sans vue consolidée des dépendances", "severity": "medium"},
      {"pain": "Aucun outil de mémorisation des décisions avec justification + résultat observé", "severity": "high"}
    ]'::jsonb,
    '[
      {"opportunity": "Bibliothèque de décisions : décision prise + contexte + résultat observé", "effort": "medium"},
      {"opportunity": "Alertes sur décisions ouvertes depuis plus de 30 jours sans action", "effort": "low"},
      {"opportunity": "Vue consolidée des projets avec dépendances et impacts croisés", "effort": "medium"},
      {"opportunity": "Cockpit décisionnel avec mémorisation automatique des choix et outcomes", "effort": "medium"}
    ]'::jsonb,
    ARRAY['Shopify Plus', 'Salesforce CRM', 'o9/JDA', 'Confluence', 'Excel', 'SAP S/4HANA']
  );

  RAISE NOTICE '8 interviews de cadrage Maison Lumen insérées avec succès.';
END $$;
