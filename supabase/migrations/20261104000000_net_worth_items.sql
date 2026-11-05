-- Manually entered net worth items (a house, a car, a loan, an account Plaid can't reach).
-- Kept out of public.accounts on purpose: that table drives the Plaid sync and
-- auto-categorization, and these rows have no transactions or Plaid ids.
create table public.net_worth_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Other',
  value numeric not null,
  -- Debts are stored as a positive value and subtracted from the total.
  is_liability boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.net_worth_items enable row level security;
create policy "authenticated household access" on public.net_worth_items for all to authenticated using (true) with check (true);
