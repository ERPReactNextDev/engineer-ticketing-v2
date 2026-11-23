create table if not exists public.boq_draft (
  request_id text primary key,
  form_values jsonb not null default '{}'::jsonb,
  boq_sections jsonb not null default '[]'::jsonb,
  boqs jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  procurement jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'completed')),
  created_by text,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  completed_at timestamptz,
  completed_by text
);

alter table public.boq_draft
  add column if not exists boqs jsonb not null default '[]'::jsonb;

create index if not exists boq_draft_status_updated_at_idx
  on public.boq_draft (status, updated_at desc);

alter table public.boq_draft enable row level security;
grant select, insert, update on table public.boq_draft to authenticated;

drop policy if exists "Authenticated staff can read BOQ drafts"
  on public.boq_draft;
create policy "Authenticated staff can read BOQ drafts"
  on public.boq_draft
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated staff can create BOQ drafts"
  on public.boq_draft;
create policy "Authenticated staff can create BOQ drafts"
  on public.boq_draft
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated staff can update BOQ drafts"
  on public.boq_draft;
create policy "Authenticated staff can update BOQ drafts"
  on public.boq_draft
  for update
  to authenticated
  using (true)
  with check (true);
