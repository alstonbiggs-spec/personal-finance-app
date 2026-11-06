-- Each person's saved Finance Calculator inputs, so their numbers come back when they
-- return to the page. One row per user; `inputs` holds every calculator in one JSON
-- document (see lib/calculators/saved-inputs.ts).
--
-- Unlike the rest of the schema this is scoped per user, not shared by the household:
-- each person runs their own scenarios without overwriting the other's.
create table public.calculator_inputs (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  inputs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.calculator_inputs enable row level security;
create policy "own calculator inputs" on public.calculator_inputs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
