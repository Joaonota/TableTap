-- =====================================================================
-- TapMenu — 0100 · Estrutura base
--
-- Hierarquia multi-tenant:  empresa (companies)
--                             └─ restaurantes (restaurants)
--                                  └─ mesas, sessões, menu, pedidos, ...
-- Todas as tabelas de um restaurante guardam também company_id
-- (preenchido por trigger a partir do restaurante — nunca pelo cliente),
-- o que simplifica o RLS e os relatórios por empresa.
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- Funções internas (não expostas pela API REST do Supabase)
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------
create or replace function private.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(value, ''))), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Planos (geridos pelo Super Admin)
--   features: [{ "featureKey": "NFC", "enabled": true }, ...]
--   limits:   [{ "resourceKey": "TABLES", "limit": 20 }, ...]  (null = ilimitado)
-- O catálogo de chaves vive no frontend (src/types/plan.ts).
-- ---------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  price numeric(12, 2) not null default 0 check (price >= 0),
  currency text not null default 'MT',
  billing_period text not null default 'monthly' check (billing_period in ('monthly', 'yearly')),
  active boolean not null default true,
  highlighted boolean not null default false,
  display_order integer not null default 0,
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  limits jsonb not null default '[]'::jsonb check (jsonb_typeof(limits) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index plans_name_unique on public.plans (lower(trim(name)));

-- ---------------------------------------------------------------------
-- Configuração global da plataforma (linha única)
-- ---------------------------------------------------------------------
create table public.platform_config (
  id boolean primary key default true check (id),
  platform_name text not null default 'TapMenu',
  support_email text not null default '',
  support_phone text not null default '',
  default_plan_id uuid references public.plans (id) on delete set null,
  trial_days integer not null default 14 check (trial_days between 0 and 365),
  allow_self_signup boolean not null default true,
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.platform_config (id) values (true);

-- ---------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  phone text not null default '',
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Empresas e subscrições
-- ---------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  legal_name text not null default '',
  slug text not null unique,
  tax_id text not null default '',
  logo_url text,
  primary_color text,
  phone text not null default '',
  email text not null default '',
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended', 'expired', 'cancelled')),
  start_date timestamptz not null default now(),
  renewal_date timestamptz not null default (now() + interval '1 month'),
  is_auto_renew boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  event text not null check (event in ('created', 'plan_changed', 'activated', 'suspended', 'renewed', 'cancelled', 'trial_started', 'expired', 'note')),
  from_plan_name text,
  to_plan_name text,
  amount numeric(12, 2),
  note text,
  performed_by text not null default '',
  created_at timestamptz not null default now()
);
create index on public.subscription_events (subscription_id, created_at desc);

-- ---------------------------------------------------------------------
-- Restaurantes
-- ---------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  -- Usado na URL pública da mesa (/m/{slug}/{mesa}) — gravada nas etiquetas NFC.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  cover_image_url text,
  logo_url text,
  address jsonb not null default '{"street": "", "city": "", "province": "", "country": "Moçambique"}'::jsonb,
  phone text not null default '',
  email text not null default '',
  currency text not null default 'MT',
  timezone text not null default 'Africa/Maputo',
  opening_hours text not null default '',
  is_active boolean not null default true,
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  settings jsonb not null default '{
    "allowCustomerOrdering": true,
    "requireTableForOrder": true,
    "serviceFeePercent": 0,
    "themeAccentColor": "#0d7a5f",
    "enabledPaymentMethods": ["cash"]
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.restaurants (company_id);

-- ---------------------------------------------------------------------
-- Equipa / utilizadores da empresa (funcionários e permissões)
--   Um registo pode existir antes da conta (convite por email); fica ligado
--   a auth.users quando a pessoa entra com esse email confirmado
--   (ver private.claim_staff_invitations).
-- ---------------------------------------------------------------------
create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null default '',
  role text not null check (role in ('company_owner', 'restaurant_admin', 'manager', 'receptionist', 'waiter', 'kitchen_staff')),
  restaurant_ids uuid[] not null default '{}',
  avatar_url text,
  hire_date date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index staff_members_company_email_unique on public.staff_members (company_id, lower(email));
create index on public.staff_members (company_id);

-- ---------------------------------------------------------------------
-- Mesas e sessões
-- ---------------------------------------------------------------------
create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  number text not null check (length(trim(number)) > 0),
  name text not null default '',
  -- Identificador permanente da URL (ex.: mesa-08). Gerado na criação e imutável.
  slug text not null,
  area text not null default 'Sala Principal',
  capacity integer not null default 4 check (capacity between 1 and 50),
  status text not null default 'free' check (status in ('free', 'occupied', 'unavailable')),
  active_session_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, slug)
);
create unique index dining_tables_number_unique on public.dining_tables (restaurant_id, lower(number));

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid not null references public.dining_tables (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed', 'cancelled')),
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by text,
  cancel_reason text,
  primary_customer_name text,
  party_size integer check (party_size is null or party_size >= 1),
  notes text,
  total numeric(12, 2) not null default 0,
  bill_requested_at timestamptz
);
-- Invariante: no máximo uma sessão ativa por mesa.
create unique index table_sessions_one_active on public.table_sessions (table_id) where status = 'active';
create index on public.table_sessions (restaurant_id, started_at desc);

alter table public.dining_tables
  add constraint dining_tables_active_session_fk
  foreign key (active_session_id) references public.table_sessions (id) on delete set null;

create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.table_sessions (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  is_primary boolean not null default false,
  -- Segredo guardado só no dispositivo do cliente; autoriza pedidos na sessão.
  token uuid not null default gen_random_uuid(),
  joined_at timestamptz not null default now()
);
create index on public.session_participants (session_id);

-- ---------------------------------------------------------------------
-- Menu: categorias, produtos, variantes e adicionais
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  image_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.categories (restaurant_id, sort_order);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  image_url text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  promotional_price numeric(12, 2) check (promotional_price is null or promotional_price >= 0),
  is_available boolean not null default true,
  is_featured boolean not null default false,
  preparation_time_minutes integer not null default 15 check (preparation_time_minutes >= 0),
  station text not null default 'kitchen' check (station in ('kitchen', 'bar')),
  removable_ingredients text[] not null default '{}',
  allergens text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_promotion boolean not null default false,
  is_spicy boolean not null default false,
  is_vegetarian boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (restaurant_id, sort_order);
create index on public.products (category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  price_delta numeric(12, 2) not null default 0,
  sort_order integer not null default 0
);
create index on public.product_variants (product_id);

create table public.product_addons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  price numeric(12, 2) not null default 0 check (price >= 0),
  is_default boolean not null default false,
  sort_order integer not null default 0
);
create index on public.product_addons (product_id);

-- ---------------------------------------------------------------------
-- Pedidos, itens e pagamentos
-- ---------------------------------------------------------------------
create table public.restaurant_counters (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  last_order_number integer not null default 1000
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.dining_tables (id) on delete set null,
  table_number text,
  table_session_id uuid references public.table_sessions (id) on delete set null,
  participant_id uuid references public.session_participants (id) on delete set null,
  is_additional boolean not null default false,
  order_number integer not null,
  order_code text not null,
  type text not null default 'dine_in' check (type in ('dine_in', 'takeaway')),
  status text not null default 'received' check (status in ('received', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'awaiting_confirmation', 'confirmed', 'paid', 'failed', 'refunded')),
  payment_method text check (payment_method in ('mpesa', 'emola', 'card', 'cash')),
  subtotal numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  service_fee numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  customer_name text,
  customer_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, order_number)
);
create index on public.orders (restaurant_id, created_at desc);
create index on public.orders (table_session_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  product_image text,
  quantity integer not null check (quantity between 1 and 99),
  unit_price numeric(12, 2) not null,
  total_price numeric(12, 2) not null,
  selected_variant jsonb,
  selected_addons jsonb not null default '[]'::jsonb,
  removed_ingredients text[] not null default '{}',
  notes text,
  station text not null default 'kitchen' check (station in ('kitchen', 'bar')),
  sort_order integer not null default 0
);
create index on public.order_items (order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  status text not null,
  updated_by text not null default '',
  note text,
  created_at timestamptz not null default now()
);
create index on public.order_status_history (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  amount numeric(12, 2) not null check (amount >= 0),
  method text not null check (method in ('mpesa', 'emola', 'card', 'cash')),
  status text not null default 'awaiting_confirmation' check (status in ('pending', 'awaiting_confirmation', 'confirmed', 'paid', 'failed', 'refunded')),
  transaction_reference text not null default '',
  customer_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payments (restaurant_id, created_at desc);

-- ---------------------------------------------------------------------
-- Atendimento e notificações
-- ---------------------------------------------------------------------
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.dining_tables (id) on delete set null,
  table_number text not null default '',
  table_session_id uuid references public.table_sessions (id) on delete set null,
  customer_name text,
  type text not null check (type in ('waiter_call', 'water', 'cutlery', 'bill', 'general_help')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'completed', 'cancelled')),
  notes text,
  assigned_to_user_id uuid references auth.users (id) on delete set null,
  assigned_to_name text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on public.service_requests (restaurant_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  type text not null check (type in ('table_occupied', 'new_order', 'additional_order', 'waiter_call', 'bill_requested', 'service_request')),
  title text not null,
  message text not null,
  table_id uuid references public.dining_tables (id) on delete set null,
  table_number text,
  table_session_id uuid references public.table_sessions (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  service_request_id uuid references public.service_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index on public.notifications (restaurant_id, created_at desc);

-- ---------------------------------------------------------------------
-- Personalização do menu (configuração visual por restaurante)
-- ---------------------------------------------------------------------
create table public.menu_customizations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null unique references public.restaurants (id) on delete cascade,
  theme jsonb not null,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Etiquetas NFC (registo administrativo — o TapMenu não grava hardware)
-- ---------------------------------------------------------------------
create table public.nfc_tags (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^TAG-[0-9]{5}$'),
  company_id uuid not null references public.companies (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.dining_tables (id) on delete set null,
  target_path text,
  configured_path text,
  status text not null default 'pending' check (status in ('pending', 'configured', 'active', 'disabled', 'reassignment_pending')),
  configured_at timestamptz,
  configured_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Uma mesa tem no máximo uma etiqueta em uso.
create unique index nfc_tags_one_per_table on public.nfc_tags (table_id) where table_id is not null and status <> 'disabled';
create index on public.nfc_tags (restaurant_id);

create table public.nfc_tag_events (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.nfc_tags (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  type text not null check (type in ('registered', 'associated', 'association_changed', 'unassigned', 'configured', 'activated', 'disabled', 'reactivated', 'note')),
  description text not null,
  actor text not null default '',
  table_id uuid,
  table_label text,
  path text,
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);
create index on public.nfc_tag_events (tag_id, created_at desc);

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  user_name text not null default '',
  action text not null,
  resource text not null default '',
  details text not null default '',
  created_at timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);
create index on public.audit_logs (company_id, created_at desc);

-- ---------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['plans', 'profiles', 'companies', 'subscriptions', 'restaurants', 'staff_members',
                           'dining_tables', 'categories', 'products', 'orders', 'payments', 'nfc_tags',
                           'menu_customizations', 'platform_config']
  loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
  end loop;
end;
$$;
