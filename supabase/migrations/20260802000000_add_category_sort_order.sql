alter table public.categories add column if not exists sort_order integer not null default 0;
with ordered as (
  select id, row_number() over (partition by parent_category order by created_at, name) - 1 as position
  from public.categories
)
update public.categories c set sort_order = ordered.position from ordered where c.id = ordered.id;
create index if not exists categories_parent_sort_order_idx on public.categories(parent_category, sort_order);
