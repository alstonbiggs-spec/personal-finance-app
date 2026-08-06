alter table public.plaid_items add column if not exists last_sync_error text;
alter table public.plaid_items add column if not exists needs_reauth boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'accounts_plaid_item_id_fkey'
  ) then
    alter table public.accounts
      add constraint accounts_plaid_item_id_fkey
      foreign key (plaid_item_id) references public.plaid_items (item_id) on delete set null;
  end if;
end $$;
