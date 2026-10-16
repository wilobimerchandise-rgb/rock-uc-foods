-- 0001_menu_core.sql
-- Menu core. Money is bigint kobo only.

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(name) between 1 and 60),
  sort_order int not null default 0,
  is_visible boolean not null default true,
  version int not null default 1,
  updated_at timestamptz not null default now()
);
create unique index menu_categories_name_uq on menu_categories(lower(name));

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  category_id uuid not null references menu_categories(id) on delete restrict,
  name text not null check(length(name) between 1 and 80),
  description text check(length(description) <= 500),
  price_kobo bigint not null check(price_kobo >= 0 and price_kobo <= 100000000000),
  portion_label text,
  allergens text[] not null default '{}',
  image_path text,
  image_alt text,
  status text not null default 'draft' check(status in ('draft', 'published', 'archived')),
  is_available boolean not null default true,
  sold_out_until timestamptz,
  is_featured boolean not null default false,
  sort_order int not null default 0,
  version int not null default 1,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);
create unique index menu_items_cat_name_uq on menu_items(category_id, lower(name));

create table menu_option_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete cascade,
  name text not null,
  min_select int not null default 0,
  max_select int not null default 1,
  check(max_select >= min_select)
);

create table menu_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references menu_option_groups(id) on delete cascade,
  name text not null,
  price_delta_kobo bigint not null default 0 check(price_delta_kobo >= 0),
  is_available boolean not null default true,
  sort_order int not null default 0
);

create table menu_item_versions (
  id bigint generated always as identity primary key,
  item_id uuid not null references menu_items(id),
  version int not null,
  snapshot jsonb not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now()
);

-- Optimistic locking trigger
create or replace function bump_version() returns trigger language plpgsql as $$
begin
  if new.version is distinct from old.version then
    raise exception 'stale version' using errcode = '40001';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

create trigger menu_categories_ver before update on menu_categories for each row execute function bump_version();
create trigger menu_items_ver before update on menu_items for each row execute function bump_version();

-- RLS
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_option_groups enable row level security;
alter table menu_options enable row level security;

create policy menu_categories_public_read on menu_categories for select using (is_visible = true);
create policy menu_items_public_read on menu_items for select using (status = 'published' and is_available = true);
