-- Create version snapshots for appointments.
-- Existing appointments receive a baseline snapshot; later changes are versioned by trigger.
CREATE TABLE IF NOT EXISTS public.appointments_history (
  LIKE public.appointments INCLUDING DEFAULTS INCLUDING CONSTRAINTS,
  history_id text NOT NULL DEFAULT gen_random_uuid()::text,
  version_number integer NOT NULL,
  version_label text NOT NULL,
  version_created_at timestamp with time zone NOT NULL DEFAULT now(),
  operation text NOT NULL,
  CONSTRAINT appointments_history_pkey PRIMARY KEY (history_id),
  CONSTRAINT appointments_history_id_version_unique UNIQUE (id, version_number),
  CONSTRAINT appointments_history_version_number_check CHECK (version_number > 0)
);

REVOKE ALL ON TABLE public.appointments_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.appointments_history TO anon, authenticated;

CREATE INDEX IF NOT EXISTS appointments_history_id_created_at_idx
  ON public.appointments_history (id, version_created_at DESC);

INSERT INTO public.appointments_history
SELECT (
  jsonb_populate_record(
    NULL::public.appointments_history,
    to_jsonb(appointment) || jsonb_build_object(
      'history_id', gen_random_uuid()::text,
      'version_number', 1,
      'version_label',
        COALESCE(NULLIF(appointment.site_visit_no::text, ''), appointment.id::text) || '_v1',
      'version_created_at', statement_timestamp(),
      'operation', 'SNAPSHOT'
    )
  )
).*
FROM public.appointments AS appointment
WHERE NOT EXISTS (
  SELECT 1
  FROM public.appointments_history AS history
  WHERE history.id = appointment.id
);

CREATE OR REPLACE FUNCTION public.save_appointment_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  source_row public.appointments%ROWTYPE;
  next_version integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (
       to_jsonb(NEW) - ARRAY['updated_at', 'messages', 'viewed_status_by_user']
     ) = (
       to_jsonb(OLD) - ARRAY['updated_at', 'messages', 'viewed_status_by_user']
     ) THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    source_row := OLD;
  ELSE
    source_row := NEW;
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO next_version
  FROM public.appointments_history
  WHERE id = source_row.id;

  INSERT INTO public.appointments_history
  SELECT (
    jsonb_populate_record(
      NULL::public.appointments_history,
      to_jsonb(source_row) || jsonb_build_object(
        'history_id', gen_random_uuid()::text,
        'version_number', next_version,
        'version_label',
          COALESCE(NULLIF(source_row.site_visit_no::text, ''), source_row.id::text)
          || '_v' || next_version,
        'version_created_at', statement_timestamp(),
        'operation', TG_OP
      )
    )
  ).*;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.save_appointment_version() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS save_appointment_version ON public.appointments;
CREATE TRIGGER save_appointment_version
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.save_appointment_version();
