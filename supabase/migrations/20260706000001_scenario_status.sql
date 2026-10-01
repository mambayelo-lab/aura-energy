-- Add status column to simulation_scenarios
ALTER TABLE public.simulation_scenarios
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'brouillon';

ALTER TABLE public.simulation_scenarios
  DROP CONSTRAINT IF EXISTS simulation_scenarios_status_check;

ALTER TABLE public.simulation_scenarios
  ADD CONSTRAINT simulation_scenarios_status_check
  CHECK (status IN ('brouillon', 'evalué', 'retenu', 'écarté'));
