-- 1) Mission Maison Lumen
INSERT INTO missions (id, owner_id, client_name, sector, status, context)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'b257b5eb-dafd-485c-a490-a4f03ea2de9a',
  'Maison Lumen',
  'retail',
  'rapport',
  'Maison de prêt-à-porter premium française. 180 boutiques, 1 200 collaborateurs, 480 M€ CA (FY 2025), marges nettes 18%, croissance 11%/an. Approvisionnement Italie, Portugal, Tunisie. Mission Aura : cartographier le SI, évaluer la maturité IA, livrer une roadmap 9 mois en 3 vagues.'
) ON CONFLICT (id) DO UPDATE SET context = EXCLUDED.context, status = EXCLUDED.status;

INSERT INTO argus_applications (mission_id, slug, name, vendor, layer, category, criticality, has_api, score, owner, notes, position_x, position_y) VALUES
('11111111-1111-1111-1111-111111111111','sap-s4','SAP S/4HANA','SAP','core','ERP Finance & Achats','critical',true,72,'DAF / DSI','Cœur Finance, Achats, Stock central. Migration ECC → S/4 en 2024.',400,200),
('11111111-1111-1111-1111-111111111111','cegid-y2','Cegid Retail Y2','Cegid','core','POS Magasins','critical',true,68,'Dir. Retail','Déployé sur 180 boutiques. Synchro stock quasi-temps réel via middleware.',200,350),
('11111111-1111-1111-1111-111111111111','shopify','Shopify Plus','Shopify','core','E-commerce','high',true,80,'Dir. Digital','Site marchand, 18% du CA. Multi-langues, 7 marchés européens.',600,350),
('11111111-1111-1111-1111-111111111111','manhattan-omni','Manhattan Active Omni','Manhattan Associates','core','OMS / WMS','critical',true,65,'Dir. Supply','Orchestration omnicanale (ship-from-store, click&collect, e-reservation).',400,400),
('11111111-1111-1111-1111-111111111111','salesforce','Salesforce Sales Cloud','Salesforce','core','CRM Clienteling','high',true,74,'Dir. CRM','Clienteling tablette vendeur. 950 K clients actifs.',800,250),
('11111111-1111-1111-1111-111111111111','o9','o9 Demand Planning','o9 Solutions','data','S&OP / Prévisions','high',true,58,'Dir. Supply','Forecast hebdomadaire SKU/magasin. Modèles statistiques + ML.',600,500),
('11111111-1111-1111-1111-111111111111','akeneo','Akeneo PIM','Akeneo','core','PIM / Catalogue','high',true,62,'Dir. Produit','Référentiel produits, 24 000 SKU actifs. EAN master.',200,200),
('11111111-1111-1111-1111-111111111111','yoobic','Yoobic Store Ops','Yoobic','edge','Exécution magasin','medium',true,55,'Dir. Retail','Check-lists, audits, formations vendeurs.',100,500),
('11111111-1111-1111-1111-111111111111','shiptify','Shiptify TMS','Shiptify','core','Transport','medium',true,48,'Dir. Supply','Pilotage transport entrant fournisseurs. Peu intégré au reste.',300,650),
('11111111-1111-1111-1111-111111111111','ariba','SAP Ariba','SAP','core','SRM / Sourcing','medium',true,52,'Dir. Achats','Sourcing fournisseurs, contrats. Sous-utilisé.',500,650),
('11111111-1111-1111-1111-111111111111','portail-fournisseur','Portail Fournisseur','Custom .NET','edge','Sourcing','low',false,35,'Dir. Achats','Portail interne legacy, échanges Excel + SFTP avec 240 fournisseurs.',700,650),
('11111111-1111-1111-1111-111111111111','powerbi','Power BI Retail Hub','Microsoft','data','BI & Reporting','high',true,70,'Dir. Data','42 rapports dirigeants. Datasets SQL Server + datalake Azure.',900,500)
ON CONFLICT (mission_id, slug) DO UPDATE SET score = EXCLUDED.score, notes = EXCLUDED.notes;

INSERT INTO argus_flows (mission_id, source_app_id, target_app_id, name, flow_type, frequency, format, volume, quality_score, notes, detected_by)
SELECT '11111111-1111-1111-1111-111111111111'::uuid, s.id, t.id, f.name, f.flow_type, f.frequency, f.format, f.volume, f.quality_score, f.notes, f.detected_by
FROM (VALUES
  ('akeneo','sap-s4','Référentiel produits (master EAN)','api','hourly','json','24K SKU',88,'API REST native Akeneo → SAP via PI/PO.','api-scan'),
  ('akeneo','shopify','Sync catalogue e-commerce','api','hourly','json','24K SKU',82,'Connecteur Akeneo App for Shopify.','api-scan'),
  ('sap-s4','manhattan-omni','Stock central → OMS','api','realtime','idoc','45K mouv./j',75,'IDoc temps réel. Latence p95 = 4s.','api-scan'),
  ('manhattan-omni','cegid-y2','Réservations & allocations boutiques','api','realtime','xml','12K msg/j',70,'Middleware MuleSoft. Échecs sporadiques en pic.','interview'),
  ('cegid-y2','sap-s4','Remontée ventes magasin','etl','daily','csv','180 fichiers/j',62,'ETL Talend nocturne. 2h35 de durée moyenne.','interview'),
  ('shopify','manhattan-omni','Commandes e-com → OMS','api','realtime','json','3.5K cmd/j',85,'Webhook Shopify → API OMS.','api-scan'),
  ('manhattan-omni','salesforce','Historique cmd client','etl','daily','json','3.5K cmd/j',60,'Job nocturne. Latence J+1 critiquée par clienteling.','interview'),
  ('sap-s4','o9','Stocks, ventes, prix','etl','daily','csv','5 fichiers',55,'SFTP. Modèle données plat, perte de granularité.','lineage-auto'),
  ('cegid-y2','o9','Ventes magasin agrégées','etl','daily','csv','1 fichier/jour',50,'Agrégation magasin/SKU. o9 redemande détail.','interview'),
  ('o9','sap-s4','Prévisions → MRP','etl','weekly','xml','3 fichiers',58,'Push hebdo lundi 6h. Format propriétaire.','interview'),
  ('portail-fournisseur','sap-s4','Réception bons de commande','sftp','daily','excel','240 fichiers/sem',32,'⚠️ Fichiers Excel hétérogènes. 18% rejets.','interview'),
  ('ariba','sap-s4','Contrats fournisseurs','api','daily','xml','~50 doc/sem',60,'Connecteur natif SAP Ariba ↔ S/4.','api-scan'),
  ('shiptify','sap-s4','Pré-avis livraison','manual','weekly','excel','exports manuels',28,'⚠️ Aucune intégration. Recopie manuelle.','interview'),
  ('sap-s4','powerbi','Datawarehouse Finance & Stock','etl','daily','sql','full extract',78,'Azure Data Factory. Nightly 23h.','api-scan'),
  ('cegid-y2','powerbi','Ventes magasin','etl','daily','sql','180 stores',75,'Idem.','api-scan'),
  ('salesforce','powerbi','Pipeline & clienteling','api','daily','json','exports API',72,'Bulk API 2.0.','api-scan'),
  ('yoobic','powerbi','Audits & exécution','api','daily','json','exports API',65,'API REST Yoobic.','api-scan')
) AS f(src_slug,tgt_slug,name,flow_type,frequency,format,volume,quality_score,notes,detected_by)
JOIN argus_applications s ON s.mission_id='11111111-1111-1111-1111-111111111111' AND s.slug=f.src_slug
JOIN argus_applications t ON t.mission_id='11111111-1111-1111-1111-111111111111' AND t.slug=f.tgt_slug;

INSERT INTO mission_interviews (id, mission_id, interviewee_name, interviewee_role, interviewee_department, interview_date, duration_min, channel, summary, key_verbatims, pain_points, opportunities, apps_mentioned) VALUES
('aaaaaaa1-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Claire Mansart','Directrice Générale','Direction','2026-05-14',55,'visio',
 'Vision stratégique : Maison Lumen veut doubler la part e-commerce en 3 ans tout en préservant l''expérience boutique. L''IA est perçue comme un levier d''efficacité, pas un projet en soi.',
 '["Notre obsession c''est la cliente, pas la techno.","Je veux des décisions plus rapides et mieux outillées, pas plus de dashboards.","Si l''IA ne se voit pas en boutique dans 12 mois, on a raté."]'::jsonb,
 '["Décisions stratégiques trop lentes (Comex toutes les 6 sem.)","Trop de rapports, pas assez d''insights actionnables","Manque d''alignement Supply ↔ Retail sur les priorités"]'::jsonb,
 '["Copilote décisions stratégiques","Recommandations clienteling en boutique","Prévision démarque IA"]'::jsonb,
 ARRAY['salesforce','powerbi']),
('aaaaaaa1-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Hugo Berthier','DSI','IT','2026-05-15',75,'onsite',
 'SI hybride : SAP S/4 modernisé en 2024, Cegid robuste, mais flux périphériques fragiles (Portail Fournisseur, Shiptify). 6 apps API-first, 6 apps legacy.',
 '["On a 24 mois de chantiers d''intégration devant nous.","Le portail fournisseur est notre maillon faible — 18% de rejets, c''est insoutenable.","Notre datalake est riche mais les métiers ne savent pas s''en servir."]'::jsonb,
 '["Flux SFTP/Excel fragiles","Datalake sous-utilisé","Pas de gouvernance data formalisée"]'::jsonb,
 '["Remplacement Portail Fournisseur","Activation datamesh","API gateway centralisée"]'::jsonb,
 ARRAY['sap-s4','cegid-y2','portail-fournisseur','shiptify','powerbi']),
('aaaaaaa1-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Sophie Levant','Directrice Supply Chain','Supply','2026-05-16',65,'onsite',
 'Forecasting o9 en place mais qualité moyenne (MAPE ~28%). Ruptures fréquentes sur best-sellers. Allocations boutiques manuelles le lundi matin.',
 '["Quand un best-seller est en rupture 3 jours, on perd 22% de conversion sur la catégorie.","Mon équipe passe 14h par semaine à faire des allocations Excel.","o9 nous donne un forecast, pas une décision."]'::jsonb,
 '["Ruptures best-sellers (12% des SKU)","Allocations manuelles","Forecast trop agrégé","Pas de visibilité fournisseur amont"]'::jsonb,
 '["IA allocation magasin","Forecast SKU/store/jour","Détection rupture anticipée 7j"]'::jsonb,
 ARRAY['o9','manhattan-omni','sap-s4','cegid-y2']),
('aaaaaaa1-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Antoine Reverdy','Directeur Retail','Retail','2026-05-17',50,'visio',
 '180 boutiques, 1 800 vendeurs. Clienteling Salesforce sous-utilisé (38% d''adoption). Vendeurs demandent des recos produits temps réel.',
 '["Le vendeur qui propose la bonne pièce au bon moment fait +35% de panier.","Salesforce c''est un CRM, pas un assistant de vente.","Yoobic c''est bien mais ça ajoute 25 min/jour à mes managers."]'::jsonb,
 '["Adoption clienteling faible","Pas de reco produit IA en boutique","Surcharge admin managers"]'::jsonb,
 '["Assistant vendeur IA","Reco cross-sell temps réel","Automatisation check-lists"]'::jsonb,
 ARRAY['salesforce','cegid-y2','yoobic']),
('aaaaaaa1-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Marc Dussart','Directeur Achats','Achats','2026-05-19',60,'visio',
 'Sourcing Italie/Portugal/Tunisie. 240 fournisseurs actifs. Portail Excel-based ralentit tout. Ariba sous-utilisé.',
 '["18% des bons de commande sont rejetés à l''entrée parce que les fournisseurs renseignent mal le portail.","On découvre les retards 5 jours après — c''est trop tard pour réagir.","Ariba on l''a, on s''en sert à 20%."]'::jsonb,
 '["Portail fournisseur obsolète","Pas de visibilité OTD amont","Ariba sous-exploité"]'::jsonb,
 '["Portail fournisseur nouvelle gen + IA validation","Alerting OTD prédictif","Activation modules Ariba"]'::jsonb,
 ARRAY['portail-fournisseur','ariba','sap-s4','shiptify']),
('aaaaaaa1-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Léa Cormand','Directrice Data & Analytics','Data','2026-05-20',70,'onsite',
 'Équipe data : 12 personnes (6 BI, 4 data eng, 2 data sci). Datalake Azure ok. Aucun modèle ML en production.',
 '["On a 4 PoC IA qui dorment depuis 18 mois faute de mise en prod.","Le métier nous demande des dashboards, on n''a pas le temps de faire du ML.","Sans MLOps on ne passera jamais à l''échelle."]'::jsonb,
 '["0 modèle ML en prod","Pas de MLOps","Data sci sous-staffée","Mode projet pas mode produit"]'::jsonb,
 '["Plateforme MLOps (Azure ML)","Feature store","Data product mindset","Recrutement 3 ML eng."]'::jsonb,
 ARRAY['powerbi','o9']),
('aaaaaaa1-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Nadège Plouvier','Directrice Digital & E-commerce','Digital','2026-05-21',45,'visio',
 'Shopify Plus performant. 18% du CA. Conversion 2.1% (benchmark 1.6%). Personnalisation reste basique.',
 '["Notre conversion est bonne mais notre AOV stagne depuis 2 ans.","On a la donnée mais pas les modèles pour personnaliser à la cliente.","La cliente passe du web à la boutique sans qu''on l''accompagne."]'::jsonb,
 '["AOV stagnant","Pas de perso 1:1","Parcours omnicanal cassé","Cookieless = perte signaux"]'::jsonb,
 '["Reco produit IA","Cross-canal unifié","Modèle propension achat"]'::jsonb,
 ARRAY['shopify','salesforce','akeneo']),
('aaaaaaa1-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Pascale Mévrey','DRH','RH','2026-05-22',40,'visio',
 'Acculturation IA des équipes très inégale. Crainte (modérée) côté boutiques. Demande forte de la part des sièges.',
 '["L''IA ne doit pas remplacer le vendeur, elle doit lui donner un super-pouvoir.","On n''a pas de programme de formation IA, c''est notre angle mort.","Les équipes data sont sollicitées de partout sans priorisation."]'::jsonb,
 '["Acculturation IA faible","Pas de programme formation","Rétention data sci difficile"]'::jsonb,
 '["Académie IA interne","Communauté de pratique","Ambassadeurs IA par direction"]'::jsonb,
 ARRAY[]::TEXT[])
ON CONFLICT (id) DO UPDATE SET summary = EXCLUDED.summary, key_verbatims = EXCLUDED.key_verbatims;

INSERT INTO ia_readiness_dimensions (mission_id, dimension, label, score, maturity_level, observations, evidences, recommendations, ord) VALUES
('11111111-1111-1111-1111-111111111111','strategy','Stratégie & Vision IA',62,'defined','Vision IA portée par la DG mais pas encore traduite en feuille de route opérationnelle priorisée.','["Verbatim Mansart: si l''IA ne se voit pas en boutique dans 12 mois on a raté","Pas de comité IA institué","4 PoC sans gouvernance"]'::jsonb,'["Instituer Comex IA mensuel","Choisir 3 cas d''usage hero","Définir KPI IA pour 2026"]'::jsonb,1),
('11111111-1111-1111-1111-111111111111','data','Données & Plateforme',55,'managed','Datalake Azure récent (2024) mais peu exploité. Qualité moyenne sur flux fournisseurs (18% rejets).','["Datalake Azure 2024","18% rejets portail fournisseur","Pas de data catalog"]'::jsonb,'["Activation data mesh","Mise en place data catalog (Purview)","Refonte ingestion fournisseurs"]'::jsonb,2),
('11111111-1111-1111-1111-111111111111','tech','Technologie & MLOps',38,'initial','Aucun modèle ML en production. Pas de plateforme MLOps.','["0 modèle en prod","Pas de feature store","6 apps API-first / 6 legacy"]'::jsonb,'["Déployer Azure ML + MLflow","API gateway centralisée","Remplacer Portail Fournisseur"]'::jsonb,3),
('11111111-1111-1111-1111-111111111111','people','Talents & Compétences',45,'managed','Équipe data 12 pers. mais data science sous-staffée. Pas de programme formation IA.','["12 data (6 BI, 4 DE, 2 DS)","Pas de programme acculturation","Rétention DS difficile (turn-over 25%)"]'::jsonb,'["Recruter 3 ML engineers","Académie IA interne","Communauté de pratique"]'::jsonb,4),
('11111111-1111-1111-1111-111111111111','governance','Gouvernance & Éthique',48,'managed','RGPD maîtrisé. Pas de framework éthique IA.','["Conformité RGPD OK","Pas de charte IA","Pas de DPIA IA"]'::jsonb,'["Charte IA Maison Lumen","Framework AI Act ready","Comité éthique trimestriel"]'::jsonb,5),
('11111111-1111-1111-1111-111111111111','use_cases','Cas d''usage & Valeur',58,'defined','11 cas d''usage prioritaires identifiés. Gain estimé : +14 M€ EBITDA à 24 mois.','["11 use cases identifiés","Top 3: forecast, clienteling, perso e-com","Gain estimé +14M€ EBITDA / 24m"]'::jsonb,'["Lancer 3 use cases vague 1","Mesure ROI systématique","Backlog priorisé trimestriel"]'::jsonb,6),
('11111111-1111-1111-1111-111111111111','ethics','Confiance & Adoption',52,'managed','Acceptation IA correcte au siège, mitigée en boutique (35% réserve).','["38% adoption clienteling","Crainte boutiques modérée","Communauté pilotes embryonnaire"]'::jsonb,'["Conduite du changement IA","Ambassadeurs par région","Programme pilote 10 boutiques"]'::jsonb,7),
('11111111-1111-1111-1111-111111111111','operations','Opérations & Industrialisation',35,'initial','PoC bloqués au stade prototype. Pas de monitoring modèles.','["4 PoC bloqués 18 mois","Pas de monitoring","Pas de retraining auto"]'::jsonb,'["Pipeline MLOps end-to-end","Monitoring drift","SLO modèles métiers"]'::jsonb,8)
ON CONFLICT (mission_id, dimension) DO UPDATE SET score = EXCLUDED.score, observations = EXCLUDED.observations;

INSERT INTO ia_readiness_roadmap (mission_id, wave, title, description, start_month, duration_months, effort, expected_gains, dependencies, kpis, ord) VALUES
('11111111-1111-1111-1111-111111111111',1,'Forecast SKU/Store IA','Modèle ML forecast par SKU/magasin/jour. Remplace Excel d''allocations. Hero use case.',1,3,'L','+3.5 M€ EBITDA (réduction ruptures 30%)',ARRAY['datalake-uplift','feature-store'],'[{"name":"MAPE","target":"<15%"},{"name":"Ruptures best-sellers","target":"-30%"}]'::jsonb,1),
('11111111-1111-1111-1111-111111111111',1,'Plateforme MLOps','Azure ML + MLflow + feature store. Socle d''industrialisation.',1,4,'L','Time-to-prod modèle ÷ 4',ARRAY[]::TEXT[],'[{"name":"Time-to-prod","target":"<6 sem."},{"name":"Modèles en prod","target":">5"}]'::jsonb,2),
('11111111-1111-1111-1111-111111111111',1,'Refonte Portail Fournisseur','Remplace l''Excel. Validation IA des bons de commande, alerting OTD.',2,4,'M','+1.8 M€ (réduction 60% rejets)',ARRAY[]::TEXT[],'[{"name":"Taux rejet","target":"<5%"},{"name":"OTD","target":">92%"}]'::jsonb,3),
('11111111-1111-1111-1111-111111111111',2,'Assistant Vendeur IA','Tablette vendeur — recos cross-sell, panier moyen, historique cliente.',4,3,'M','+4.2 M€ (AOV +12%)',ARRAY['datalake-uplift'],'[{"name":"AOV","target":"+12%"},{"name":"Adoption clienteling","target":">70%"}]'::jsonb,4),
('11111111-1111-1111-1111-111111111111',2,'Reco Produit E-commerce','Modèle propension achat + ranking perso. Shopify Plus.',4,3,'M','+2.3 M€ (CR +0.4pt, AOV +8%)',ARRAY['mlops-platform'],'[{"name":"CR e-com","target":"+0.4pt"}]'::jsonb,5),
('11111111-1111-1111-1111-111111111111',2,'Data Catalog & Mesh','Microsoft Purview + ownership data products par domaine.',5,4,'M','Time-to-data ÷ 3',ARRAY[]::TEXT[],'[{"name":"Data products gouvernés","target":">25"}]'::jsonb,6),
('11111111-1111-1111-1111-111111111111',3,'Copilote Décisions Comex','Aura Decision Compass connecté aux données Lumen.',7,3,'M','Cycle décision ÷ 2',ARRAY['data-catalog'],'[{"name":"Décisions /Comex","target":"×2"}]'::jsonb,7),
('11111111-1111-1111-1111-111111111111',3,'Détection Démarque IA','Computer vision + ML. Boutiques pilotes 20 → 180.',7,3,'M','+1.4 M€ (démarque -25%)',ARRAY['mlops-platform'],'[{"name":"Démarque","target":"-25%"}]'::jsonb,8),
('11111111-1111-1111-1111-111111111111',3,'Académie IA Lumen','Programme formation + ambassadeurs IA + communauté pratique.',7,3,'S','Adoption +30pt',ARRAY[]::TEXT[],'[{"name":"Collab. formés","target":">800"}]'::jsonb,9);
