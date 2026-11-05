alter table public.job_requests
  add column if not exists contact_designation text;
