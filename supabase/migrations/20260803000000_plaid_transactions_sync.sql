alter table public.categories add column if not exists sort_order integer not null default 0;
alter table public.upcoming_expenses add column if not exists notes text;
alter table public.plaid_items add column if not exists sync_cursor text;
alter table public.plaid_items add column if not exists last_synced_at timestamptz;
alter table public.accounts add column if not exists current_balance numeric;
alter table public.accounts add column if not exists available_balance numeric;
alter table public.accounts add column if not exists balance_updated_at timestamptz;
create unique index if not exists transactions_plaid_transaction_id_key on public.transactions(plaid_transaction_id) where plaid_transaction_id is not null;
create unique index if not exists accounts_plaid_account_id_key on public.accounts(plaid_account_id) where plaid_account_id is not null;

-- Plaid access tokens remain protected by the absence of any authenticated-user policy.
-- Only the service-role client may read or write public.plaid_items.
