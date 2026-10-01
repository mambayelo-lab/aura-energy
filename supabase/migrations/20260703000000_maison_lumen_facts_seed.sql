-- Migration: Replace generic facts with Maison Lumen SI-sourced facts
-- Source systems: SAP S/4HANA, CEGX Finance, Cegid Retail POS, Manhattan WMS, Salesforce CRM, Shopify, SAP CO-PA

-- 1. Remove old generic facts from prior seed apps
DELETE FROM facts WHERE source_app IN (
  'NexERP','NexCash','Meridian','WebStore','NinePlan','D&B','SkyERP','Argus','Aura','CEGX','SharePoint'
);

-- 2. Insert Maison Lumen facts
INSERT INTO facts (object_name, attribute_name, value_text, value_number, source_app, observed_at, confidence) VALUES

-- ── SUPPLIERS (SAP S/4HANA) ──
('Supplier','textilpro_otif_pct',NULL,67,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','textilpro_lead_time_days',NULL,47,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','textilpro_financial_score',NULL,32,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','textilpro_dependency_pct',NULL,34,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','textilpro_quality_score',NULL,58,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','textilpro_country_code','FR',NULL,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','textilpro_pending_orders_count',NULL,28,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','textilpro_delay_weeks',NULL,6,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','textilpro_buffer_stock_weeks',NULL,3.2,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','fabricplus_otif_pct',NULL,94,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','fabricplus_lead_time_days',NULL,21,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','fabricplus_financial_score',NULL,78,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','fabricplus_dependency_pct',NULL,12,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','fabricplus_quality_score',NULL,86,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','fabricplus_country_code','MA',NULL,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','luxweave_otif_pct',NULL,88,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','luxweave_lead_time_days',NULL,28,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','luxweave_financial_score',NULL,71,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','luxweave_dependency_pct',NULL,8,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','luxweave_quality_score',NULL,82,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','luxweave_country_code','IT',NULL,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','silkcraft_otif_pct',NULL,79,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','silkcraft_lead_time_days',NULL,38,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','silkcraft_financial_score',NULL,55,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','silkcraft_dependency_pct',NULL,19,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','silkcraft_quality_score',NULL,74,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','silkcraft_country_code','VN',NULL,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','texeuro_otif_pct',NULL,91,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','texeuro_lead_time_days',NULL,24,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','texeuro_financial_score',NULL,82,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','texeuro_dependency_pct',NULL,11,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','texeuro_quality_score',NULL,89,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),
('Supplier','texeuro_country_code','PT',NULL,'SAP_S4HANA',NOW() - INTERVAL '2 hours',0.94),

-- ── CASH POSITION (CEGX Finance) ──
('CashPosition','balance_j0_eur',NULL,1240000,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','balance_j30_forecast_eur',NULL,-340000,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','dso_days',NULL,68,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','dso_target_days',NULL,45,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','receivables_overdue_30d_eur',NULL,68000,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','revolving_credit_eur',NULL,500000,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','revolving_rate_pct',NULL,4.2,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','payroll_month_eur',NULL,420000,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','textilpro_payment_due_eur',NULL,280000,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','critical_date_days',NULL,8,'CEGX',NOW() - INTERVAL '1 hour',0.97),
('CashPosition','cash_coverage_days',NULL,23,'CEGX',NOW() - INTERVAL '1 hour',0.97),

-- ── STORES (Cegid Retail POS) ──
('Store','paris_opera_ca_mtd_eur',NULL,185000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','paris_opera_target_mtd_eur',NULL,200000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','paris_opera_conversion_rate_pct',NULL,4.2,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','paris_opera_avg_basket_eur',NULL,185,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','paris_marais_ca_mtd_eur',NULL,142000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','paris_marais_target_mtd_eur',NULL,180000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','paris_marais_conversion_rate_pct',NULL,3.8,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','paris_marais_avg_basket_eur',NULL,162,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','lyon_ca_mtd_eur',NULL,98000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','lyon_target_mtd_eur',NULL,110000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','lyon_conversion_rate_pct',NULL,3.9,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','lyon_avg_basket_eur',NULL,148,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','bordeaux_ca_mtd_eur',NULL,72000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','bordeaux_target_mtd_eur',NULL,80000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','bordeaux_conversion_rate_pct',NULL,3.5,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','bordeaux_avg_basket_eur',NULL,135,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','lille_ca_mtd_eur',NULL,61000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','lille_target_mtd_eur',NULL,75000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','lille_conversion_rate_pct',NULL,3.2,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','lille_avg_basket_eur',NULL,128,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','nice_ca_mtd_eur',NULL,54000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','nice_target_mtd_eur',NULL,70000,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','nice_conversion_rate_pct',NULL,2.9,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','nice_avg_basket_eur',NULL,122,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','store_underperforming_count',NULL,4,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),
('Store','stores_below_85pct_target_count',NULL,4,'CEGID_POS',NOW() - INTERVAL '3 hours',0.92),

-- ── ECOMMERCE (Shopify) ──
('Revenue','ecom_revenue_mtd_eur',NULL,1240000,'SHOPIFY',NOW() - INTERVAL '2 hours',0.96),
('Revenue','ecom_growth_yoy_pct',NULL,18,'SHOPIFY',NOW() - INTERVAL '2 hours',0.96),
('Revenue','ecom_conversion_rate_pct',NULL,2.4,'SHOPIFY',NOW() - INTERVAL '2 hours',0.96),
('Revenue','ecom_avg_basket_eur',NULL,94,'SHOPIFY',NOW() - INTERVAL '2 hours',0.96),
('Revenue','ecom_return_rate_pct',NULL,18,'SHOPIFY',NOW() - INTERVAL '2 hours',0.96),

-- ── INVENTORY (Manhattan WMS) ──
('Inventory','sku_coverage_below_7d_count',NULL,18,'MANHATTAN_WMS',NOW() - INTERVAL '4 hours',0.95),
('Inventory','sku_without_warehouse_stock_count',NULL,8,'MANHATTAN_WMS',NOW() - INTERVAL '4 hours',0.95),
('Inventory','avg_coverage_days',NULL,6.2,'MANHATTAN_WMS',NOW() - INTERVAL '4 hours',0.95),
('Inventory','weekly_sales_vs_forecast_pct',NULL,34,'MANHATTAN_WMS',NOW() - INTERVAL '4 hours',0.95),
('Inventory','warehouse_lyon_available_units',NULL,340,'MANHATTAN_WMS',NOW() - INTERVAL '4 hours',0.95),
('Inventory','sku_total_stockout_count',NULL,3,'MANHATTAN_WMS',NOW() - INTERVAL '4 hours',0.95),
('Inventory','wms_service_rate_pct',NULL,87.3,'MANHATTAN_WMS',NOW() - INTERVAL '4 hours',0.95),
('Inventory','total_sku_managed_count',NULL,1240,'MANHATTAN_WMS',NOW() - INTERVAL '4 hours',0.95),

-- ── MARGINS (SAP CO-PA) ──
('Margin','gross_margin_global_pct',NULL,47.2,'SAP_COPA',NOW() - INTERVAL '6 hours',0.91),
('Margin','gross_margin_target_pct',NULL,49,'SAP_COPA',NOW() - INTERVAL '6 hours',0.91),
('Margin','margin_spring_summer_collection_pct',NULL,44.8,'SAP_COPA',NOW() - INTERVAL '6 hours',0.91),
('Margin','margin_ecom_pct',NULL,38.2,'SAP_COPA',NOW() - INTERVAL '6 hours',0.91),
('Margin','margin_flagship_stores_pct',NULL,51.3,'SAP_COPA',NOW() - INTERVAL '6 hours',0.91),
('Margin','markdowns_forecast_s2_eur',NULL,1800000,'SAP_COPA',NOW() - INTERVAL '6 hours',0.91),
('Margin','fixed_costs_pct_revenue',NULL,29.4,'SAP_COPA',NOW() - INTERVAL '6 hours',0.91),
('Margin','ebitda_margin_pct',NULL,8.2,'SAP_COPA',NOW() - INTERVAL '6 hours',0.91),

-- ── CRM / CUSTOMERS (Salesforce) ──
('Customer','vip_count',NULL,2847,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','vip_retention_rate_pct',NULL,73,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','vip_retention_target_pct',NULL,80,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','vip_purchase_frequency_per_year',NULL,3.1,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','vip_avg_basket_eur',NULL,420,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','email_open_rate_pct',NULL,22,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','email_open_target_pct',NULL,28,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','nps_stores_score',NULL,67,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','nps_target_score',NULL,72,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','churn_risk_vip_count',NULL,312,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93),
('Customer','new_customer_acquisition_mtd',NULL,847,'SALESFORCE',NOW() - INTERVAL '3 hours',0.93)

ON CONFLICT DO NOTHING;
