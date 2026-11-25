ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS viewed_status_by_user jsonb NOT NULL DEFAULT '{}'::jsonb;
