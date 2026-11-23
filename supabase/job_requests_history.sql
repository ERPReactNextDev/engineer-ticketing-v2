-- Uses the existing public.job_requests_history table.
-- Existing rows are preserved; this only records changes made after installation.
CREATE OR REPLACE FUNCTION public.save_job_request_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  source_row public.job_requests%ROWTYPE;
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
  FROM public.job_requests_history
  WHERE id = source_row.id;

  INSERT INTO public.job_requests_history
  SELECT (
    jsonb_populate_record(
      NULL::public.job_requests_history,
      to_jsonb(source_row) || jsonb_build_object(
        'history_id', gen_random_uuid()::text,
        'version_number', next_version,
        'version_label',
          COALESCE(source_row.job_request_no, source_row.id) || '_v' || next_version,
        'version_created_at', statement_timestamp(),
        'operation', TG_OP
      )
    )
  ).*;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.save_job_request_version() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  history_trigger record;
BEGIN
  FOR history_trigger IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.job_requests'::regclass
      AND tgfoid = 'public.save_job_request_version()'::regprocedure
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.job_requests', history_trigger.tgname);
  END LOOP;
END;
$$;

CREATE TRIGGER save_job_request_version
AFTER INSERT OR UPDATE OR DELETE ON public.job_requests
FOR EACH ROW
EXECUTE FUNCTION public.save_job_request_version();
