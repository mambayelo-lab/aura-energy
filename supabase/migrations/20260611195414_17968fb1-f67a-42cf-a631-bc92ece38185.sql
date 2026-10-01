
CREATE POLICY "missions_read_public" ON public.missions FOR SELECT USING (true);
CREATE POLICY "mission_sections_read_public" ON public.mission_sections FOR SELECT USING (true);
GRANT SELECT ON public.missions TO anon;
GRANT SELECT ON public.mission_sections TO anon;
