CREATE TABLE IF NOT EXISTS capability_chart_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_slug text NOT NULL,
  chart_type text NOT NULL CHECK (chart_type IN ('signals_severity', 'facts_table', 'recommendations_scatter', 'kpi_bar')),
  enabled boolean NOT NULL DEFAULT true,
  label text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (pack_slug, chart_type)
);

ALTER TABLE capability_chart_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_chart_configs" ON capability_chart_configs FOR ALL TO authenticated USING (true);
