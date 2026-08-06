drop index if exists public.transactions_plaid_transaction_id_key;
create unique index if not exists transactions_plaid_transaction_id_key on public.transactions(plaid_transaction_id);
