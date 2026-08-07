alter table public.categories drop constraint if exists categories_parent_category_check;
alter table public.categories add constraint categories_parent_category_check check (parent_category in ('wants','needs','savings','income'));
