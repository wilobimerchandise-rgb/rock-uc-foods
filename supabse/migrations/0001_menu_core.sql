-- Menu core. Money is bigint kobo. Drafts may have no price; published items must.
create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order int not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index menu_categories_name_uq on menu_categories (lower(btrim(name))) where status <> 'archived';

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references menu_categories(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  portion text,
  price_kobo bigint check (price_kobo is null or (price_kobo > 0 and price_kobo <= 10000000000)),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  sold_out_today boolean not null default false,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_needs_price check (status <> 'published' or price_kobo is not null)
);
create unique index menu_items_name_uq on menu_items (category_id, lower(btrim(name))) where status <> 'archived';

create table menu_item_extras (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references menu_items(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  price_kobo bigint not null check (price_kobo > 0 and price_kobo <= 10000000000)
);

-- Optimistic locking: an update must present the current version; the trigger bumps it.
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

alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_item_extras enable row level security;
-- Public (anon) may read published rows only. Staff write policies are added with the roles migration.
create policy menu_categories_public_read on menu_categories for select using (status = 'published');
create policy menu_items_public_read on menu_items for select using (status = 'published' and
  exists (select 1 from menu_categories c where c.id = category_id and c.status = 'published'));
create policy menu_extras_public_read on menu_item_extras for select using (
  exists (select 1 from menu_items i where i.id = item_id and i.status = 'published'));
