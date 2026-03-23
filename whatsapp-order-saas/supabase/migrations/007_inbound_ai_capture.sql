-- 007_inbound_ai_capture.sql
-- Inbound WhatsApp message capture, AI order parsing, draft orders, and product aliases.

-- ─── Message direction / parse status enums ──────────────────────────────────

do $$ begin
  create type public.message_direction as enum ('inbound','outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.parse_status as enum ('pending','parsed','needs_review','failed');
exception when duplicate_object then null; end $$;

-- ─── Inbound message events ───────────────────────────────────────────────────
-- Idempotency: unique on (provider, provider_message_id)

create table if not exists public.inbound_message_events (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.users(id) on delete cascade,
  provider            text not null default 'meta_whatsapp',
  provider_message_id text not null,
  from_phone          text not null,
  to_phone            text not null,
  message_type        text not null default 'text',
  message_text        text,
  payload             jsonb not null default '{}',
  received_at         timestamptz not null default now(),
  constraint inbound_message_events_provider_msgid_uniq unique (provider, provider_message_id)
);

create index if not exists inbound_events_workspace_idx on public.inbound_message_events(workspace_id, received_at desc);
create index if not exists inbound_events_from_phone_idx on public.inbound_message_events(workspace_id, from_phone);

-- ─── AI parse attempts ────────────────────────────────────────────────────────

create table if not exists public.ai_parse_attempts (
  id                   uuid primary key default gen_random_uuid(),
  inbound_message_id   uuid not null references public.inbound_message_events(id) on delete cascade,
  workspace_id         uuid not null references public.users(id) on delete cascade,
  model                text not null,
  confidence           numeric(5,4),
  status               public.parse_status not null default 'pending',
  structured_output    jsonb,
  error                text,
  created_at           timestamptz not null default now()
);

create index if not exists ai_parse_workspace_idx on public.ai_parse_attempts(workspace_id, created_at desc);
create index if not exists ai_parse_message_idx   on public.ai_parse_attempts(inbound_message_id);

-- ─── Order drafts ─────────────────────────────────────────────────────────────
-- status flow: pending_review → approved → converted
--                             → rejected

create table if not exists public.order_drafts (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.users(id) on delete cascade,
  inbound_message_id   uuid references public.inbound_message_events(id) on delete set null,
  customer_phone       text not null,
  customer_name        text,
  items                jsonb not null default '[]',
  notes                text,
  confidence           numeric(5,4),
  status               text not null default 'pending_review'
                       check (status in ('pending_review','approved','rejected','converted')),
  reviewed_by          uuid references auth.users(id),
  reviewed_at          timestamptz,
  created_order_id     uuid references public.orders(id),
  created_at           timestamptz not null default now()
);

create index if not exists order_drafts_workspace_status_idx on public.order_drafts(workspace_id, status, created_at desc);
create index if not exists order_drafts_message_idx          on public.order_drafts(inbound_message_id);

-- ─── Product aliases ─────────────────────────────────────────────────────────
-- Allow vendors to map common customer phrases to canonical products
-- e.g. "shawarma" → Chicken Shawarma (product_id)

create table if not exists public.product_aliases (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  alias        text not null,
  created_at   timestamptz not null default now(),
  constraint product_aliases_workspace_alias_uniq unique (workspace_id, alias)
);

create index if not exists product_aliases_workspace_idx on public.product_aliases(workspace_id);
create index if not exists product_aliases_product_idx   on public.product_aliases(product_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.inbound_message_events enable row level security;
alter table public.ai_parse_attempts       enable row level security;
alter table public.order_drafts            enable row level security;
alter table public.product_aliases         enable row level security;

-- Inbound events: readable by workspace members, written only by service role (webhook)
create policy "inbound_events: workspace read" on public.inbound_message_events
  for select using (workspace_id = public.my_workspace_id());

-- AI parse attempts: readable by workspace members
create policy "ai_parse: workspace read" on public.ai_parse_attempts
  for select using (workspace_id = public.my_workspace_id());

-- Order drafts: workspace read; owner/staff can update (approve/reject)
create policy "drafts: workspace read" on public.order_drafts
  for select using (workspace_id = public.my_workspace_id());

create policy "drafts: owner_staff update" on public.order_drafts
  for update using (
    workspace_id = public.my_workspace_id()
    and public.my_workspace_role() in ('owner','staff')
  ) with check (workspace_id = public.my_workspace_id());

-- Product aliases: workspace read; owner/staff can manage
create policy "aliases: workspace read" on public.product_aliases
  for select using (workspace_id = public.my_workspace_id());

create policy "aliases: owner_staff write" on public.product_aliases
  for all using (
    workspace_id = public.my_workspace_id()
    and public.my_workspace_role() in ('owner','staff')
  ) with check (workspace_id = public.my_workspace_id());
