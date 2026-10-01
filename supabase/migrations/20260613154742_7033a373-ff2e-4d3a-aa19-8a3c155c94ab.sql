
ALTER TABLE public.mission_interviews
  ADD COLUMN IF NOT EXISTS qa_pairs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS proposed_synthesis jsonb,
  ADD COLUMN IF NOT EXISTS synthesis_validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validated_by uuid,
  ADD COLUMN IF NOT EXISTS extracted jsonb NOT NULL DEFAULT '{"decisions":[],"signals":[],"facts":[],"ontology":[],"sources":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS interview_type text NOT NULL DEFAULT 'stakeholder',
  ADD COLUMN IF NOT EXISTS application_ref text,
  ADD COLUMN IF NOT EXISTS meeting_report text,
  ADD COLUMN IF NOT EXISTS face_to_face_notes text;

CREATE INDEX IF NOT EXISTS idx_interviews_type ON public.mission_interviews(interview_type);
CREATE INDEX IF NOT EXISTS idx_interviews_app_ref ON public.mission_interviews(application_ref);
