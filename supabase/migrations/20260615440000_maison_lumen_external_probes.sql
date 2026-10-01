-- Maison Lumen — External probes for retail fashion decision support
-- Sources: World Bank, Yahoo Finance, Google News RSS
-- These feed the Argus External panel in Admin and enrich Decision Support signals

DO $$
BEGIN

-- Market quotes — competitors & indices (retail fashion sector)
INSERT INTO public.argus_external_probes(name, kind, target, params, refresh_interval_minutes, pack_slug, notes) VALUES
  ('Inditex (Zara) cotation', 'market_quote', 'ITX.MC', '{}', 360, 'pricing-strategy', 'Concurrent direct — positionnement prix'),
  ('H&M cotation', 'market_quote', 'HM-B.ST', '{}', 360, 'pricing-strategy', 'Concurrent fast fashion'),
  ('Mango (Punto Fa) — indisponible en bourse', 'news_rss', 'Mango fashion strategy', '{}', 720, 'pricing-strategy', 'Suivi stratégie Mango via actualités'),
  ('Zalando cotation', 'market_quote', 'ZAL.DE', '{}', 360, 'omnichannel-optimization', 'Leader e-commerce mode Europe'),
  ('ASOS cotation', 'market_quote', 'ASC.L', '{}', 360, 'omnichannel-optimization', 'E-commerce mode UK/EU'),
  ('Kering cotation', 'market_quote', 'KER.PA', '{}', 360, 'collection-investment', 'Benchmark positionnement premium'),
  ('LVMH cotation', 'market_quote', 'MC.PA', '{}', 360, 'collection-investment', 'Benchmark luxe accessible'),
  ('XRT ETF (US Retail)', 'market_quote', 'XRT', '{}', 720, NULL, 'Indice retail US — signal macro'),
  ('Euronext Retail Index', 'market_quote', '^FCHI', '{}', 1440, NULL, 'CAC 40 — proxy marché EU')
ON CONFLICT DO NOTHING;

-- Macro indicators relevant to fashion retail
INSERT INTO public.argus_external_probes(name, kind, target, params, refresh_interval_minutes, pack_slug, notes) VALUES
  ('Confiance consommateurs France', 'macro_worldbank', 'NY.GDP.PCAP.KD.ZG', '{"country":"FR","label":"PIB/habitant FR %"}', 1440, 'margin-management', 'Proxy pouvoir achat consommateurs'),
  ('Chômage France (World Bank)', 'macro_worldbank', 'SL.UEM.TOTL.ZS', '{"country":"FR","label":"Chômage France %"}', 1440, 'customer-profitability', 'Impact pouvoir achat clientèle'),
  ('Inflation France (IPC)', 'macro_worldbank', 'FP.CPI.TOTL.ZG', '{"country":"FR","label":"Inflation France %"}', 1440, 'margin-management', 'Pression prix matières & logistique'),
  ('Croissance PIB France', 'macro_worldbank', 'NY.GDP.MKTP.KD.ZG', '{"country":"FR","label":"PIB France %"}', 1440, NULL, 'Contexte macro général'),
  ('Exportations France (% PIB)', 'macro_worldbank', 'NE.EXP.GNFS.ZS', '{"country":"FR","label":"Export FR % PIB"}', 1440, 'ma-opportunity', 'Dynamique export marques françaises'),
  ('EUR/USD', 'market_quote', 'EURUSD=X', '{}', 360, 'margin-management', 'Impact achats USD (coton, polyester)'),
  ('EUR/CNY', 'market_quote', 'EURCNY=X', '{}', 360, 'margin-management', 'Impact achats sourcing Asie'),
  ('Coton (Cotton #2 Futures)', 'market_quote', 'CT=F', '{}', 720, 'margin-management', 'Matière première clé — impact marges')
ON CONFLICT DO NOTHING;

-- News / signals faibles sectoriels retail fashion
INSERT INTO public.argus_external_probes(name, kind, target, params, refresh_interval_minutes, pack_slug, notes) VALUES
  ('Actualités mode & retail France', 'news_rss', 'mode retail France stratégie', '{}', 360, NULL, 'Veille sectorielle générale'),
  ('Actualités promotions & soldes', 'news_rss', 'promotions soldes mode France 2026', '{}', 360, 'promotion-effectiveness', 'Calendrier promo concurrents'),
  ('Actualités e-commerce mode', 'news_rss', 'e-commerce mode omnichannel 2026', '{}', 360, 'omnichannel-optimization', 'Tendances digital retail'),
  ('Actualités logistique retail', 'news_rss', 'logistique supply chain mode France', '{}', 720, 'logistics-performance', 'Disruptions transport & délais'),
  ('Actualités M&A mode France', 'news_rss', 'fusion acquisition mode retail France', '{}', 720, 'ma-opportunity', 'Opportunités consolidation secteur'),
  ('Actualités RSE mode durable', 'news_rss', 'RSE mode durable France réglementation', '{}', 1440, NULL, 'Contraintes réglementaires & tendances'),
  ('Actualités assortiment & tendances', 'news_rss', 'tendances mode saison collection 2026', '{}', 720, 'assortment-optimization', 'Signaux tendances produit'),
  ('Actualités pricing & inflation mode', 'news_rss', 'prix vêtements inflation pouvoir achat', '{}', 720, 'pricing-strategy', 'Sensibilité prix consommateurs'),
  ('Fiabilité fournisseurs mode Asie', 'news_rss', 'fournisseurs textile Asie délais qualité', '{}', 1440, 'logistics-performance', 'Risques supply chain amont')
ON CONFLICT DO NOTHING;

END $$;
