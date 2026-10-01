CREATE TABLE IF NOT EXISTS public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('urgent', 'opportunity', 'ok')),
  category text NOT NULL,
  title text NOT NULL,
  description text,
  impact_eur numeric,
  deadline_date date,
  source_app text,
  source_attribute text,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS signals_mission_id_idx ON public.signals(mission_id);
CREATE INDEX IF NOT EXISTS signals_severity_idx ON public.signals(severity);
