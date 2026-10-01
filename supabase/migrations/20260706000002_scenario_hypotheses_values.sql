-- Store raw slider values at the time a scenario was saved
-- Enables reloading a scenario back into the Constructeur exactly as it was
ALTER TABLE public.simulation_scenarios
  ADD COLUMN IF NOT EXISTS hypotheses_values jsonb;
