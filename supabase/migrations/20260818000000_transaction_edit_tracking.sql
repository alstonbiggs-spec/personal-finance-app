-- Preserves the Plaid-provided amount/date the first time a user manually edits either
-- field, so the UI can show "originally $X" / "originally <date>" next to the edit.
-- Stays null until the first edit; never overwritten again after that.
alter table public.transactions add column if not exists original_amount numeric;
alter table public.transactions add column if not exists original_date date;
