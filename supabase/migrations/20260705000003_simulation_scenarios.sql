-- Simulation scenarios saved by decision-makers
CREATE TABLE IF NOT EXISTS public.simulation_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE,
  name text NOT NULL,
  decision_model_slug text NOT NULL,
  hypotheses jsonb NOT NULL DEFAULT '{}'::jsonb,
  kpis jsonb DEFAULT '{}'::jsonb,
  aura_narrative text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sim_scenarios_mission_idx ON public.simulation_scenarios(mission_id);
CREATE INDEX IF NOT EXISTS sim_scenarios_slug_idx   ON public.simulation_scenarios(decision_model_slug);
