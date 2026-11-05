-- Supabase schema for the Firebase "job_requests" collection.
-- Keep the Firebase document ID in `id` when importing existing records.
-- Firebase field names are mapped to snake_case column names.

create table if not exists public.job_requests (
  id text primary key default gen_random_uuid()::text,

  job_request_no text,
  project_title text,
  project_name text,
  client_name text,
  location text,
  location_coordinates jsonb not null default '{}'::jsonb,
  agent_name text,
  contact_person text,
  contact_designation text,
  email text,
  contact_number text,
  scope_of_work text,
  scope_qty integer,
  mounting_height text,
  working_time_from text,
  working_time_to text,
  working_time text,
  site_installation text[] not null default '{}'::text[],
  in_house text[] not null default '{}'::text[],
  permits text[] not null default '{}'::text[],
  working_days text[] not null default '{}'::text[],
  total_working_days integer not null default 0
    constraint job_requests_total_working_days_nonnegative check (total_working_days >= 0),
  other_assistance text,
  other_documents text,
  priority text not null default 'MEDIUM',
  temp_facility text,
  safety_induction text,
  safety_notes text,
  attachments text[] not null default '{}'::text[],
  attachment_url text,

  status text not null default 'JR FORM FORWARD TO ENGINEERING',
  created_by text,
  created_by_signature text,
  submitted_by text,
  submitted_by_name text,
  submitted_by_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  member_notes text,
  admin_notes text,
  leader_notes text,
  manager_notes text,
  procurement_notes text,
  viewed_status_by_user jsonb not null default '{}'::jsonb,

  engineering_member_approved_at timestamptz,
  approved_by_engineering_member text,
  approved_by_engineering_member_signature text,
  engineering_leader_approved_at timestamptz,
  approved_by_engineering_leader text,
  approved_by_engineering_leader_signature text,
  engineering_manager_approved_at timestamptz,
  approved_by_engineering_manager text,
  approved_by_engineering_manager_signature text,
  completed_at timestamptz,
  procurement_approved_at timestamptz,
  approved_by_procurement text,
  approved_by_procurement_name text,
  approved_by_procurement_signature text,

  signed_jr_form_url text,
  signed_jr_form_viewer_url text,
  scope_of_work_url text,
  scope_of_work_viewer_url text,

  fill_up_form jsonb,
  procurement_say numeric,
  procurement_summary jsonb,
  messages jsonb not null default '[]'::jsonb
);

alter table public.job_requests
  add column if not exists scope_qty integer;

alter table public.job_requests
  add column if not exists contact_designation text;

-- Safe to run on a table created before `total_working_days` was added.
alter table public.job_requests
  add column if not exists total_working_days integer not null default 0;

update public.job_requests
  set total_working_days = 0
  where total_working_days is null;

alter table public.job_requests
  alter column total_working_days set default 0,
  alter column total_working_days set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'job_requests_total_working_days_nonnegative'
      and conrelid = 'public.job_requests'::regclass
  ) then
    alter table public.job_requests
      add constraint job_requests_total_working_days_nonnegative
      check (total_working_days >= 0);
  end if;
end
$$;

create index if not exists job_requests_created_at_idx
  on public.job_requests (created_at desc);

create index if not exists job_requests_status_idx
  on public.job_requests (status);

create index if not exists job_requests_job_request_no_idx
  on public.job_requests (job_request_no);

create index if not exists job_requests_created_by_idx
  on public.job_requests (created_by);

create index if not exists job_requests_submitted_by_idx
  on public.job_requests (submitted_by);

-- RLS is enabled with no client policies, so browser/API access is denied until
-- policies appropriate to the application's authenticated roles are added.
alter table public.job_requests enable row level security;

-- Allow public (unauthenticated) read access via the publishable key
create policy "Allow public read access"
  on public.job_requests
  for select
  to public
  using (true);

-- Allow authenticated users (including those with publishable key) to insert
create policy "Allow authenticated insert"
  on public.job_requests
  for insert
  to authenticated
  with check (true);

-- Allow authenticated users to update their own records
create policy "Allow authenticated update"
  on public.job_requests
  for update
  to authenticated
  using (auth.uid()::text = created_by OR created_by IS NULL)
  with check (auth.uid()::text = created_by OR created_by IS NULL);

-- Allow authenticated users to delete their own records
create policy "Allow authenticated delete"
  on public.job_requests
  for delete
  to authenticated
  using (auth.uid()::text = created_by OR created_by IS NULL);
