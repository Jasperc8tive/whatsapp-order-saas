-- ============================================================
--  Migration 003 — Missing Tables
--  Adds all tables referenced in application code but absent
--  from the base schema.  Safe to run multiple times (if-not-exists
--  guards are used throughout).
-- ============================================================


-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type public.workspace_role as enum (
    'owner', 'staff', 'delivery_manager'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invitation_status as enum (
    'pending', 'accepted', 'revoked', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum (
    'queued', 'running', 'done', 'failed', 'dead'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.automation_trigger as enum (
    'order_created',
    'order_status_changed',
    'payment_pending',
    'payment_confirmed',
    'delivery_status_changed',
    'no_customer_response'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.automation_run_status as enum (
    'running', 'skipped', 'succeeded', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_provider as enum (
    'meta_whatsapp'
  );
exception when duplicate_object then null; end $$;


-- ============================================================
-- 1. WORKSPACE_MEMBERS
--    Team members with roles scoped per vendor workspace.
-- ============================================================

create table if not exists public.workspace_members (
  id              uuid                  primary key default uuid_generate_v4(),
  workspace_id    uuid                  not null references public.users(id) on delete cascade,
  user_id         uuid                  not null references auth.users(id)   on delete cascade,
  role            public.workspace_role not null default 'staff',
  display_name    text,
  is_active       boolean               not null default true,
  invited_by      uuid                  references auth.users(id) on delete set null,
  created_at      timestamptz           not null default now(),
  updated_at      timestamptz           not null default now(),

  unique (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Team members per vendor workspace with RBAC roles (owner/staff/delivery_manager).';

create index if not exists workspace_members_workspace_id_idx
  on public.workspace_members(workspace_id);
create index if not exists workspace_members_user_id_idx
  on public.workspace_members(user_id);

drop trigger if exists trg_workspace_members_updated_at on public.workspace_members;
create trigger trg_workspace_members_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();


-- ============================================================
-- 2. WORKSPACE_INVITATIONS
--    Pending email invitations for team members.
-- ============================================================

create table if not exists public.workspace_invitations (
  id              uuid                      primary key default uuid_generate_v4(),
  workspace_id    uuid                      not null references public.users(id) on delete cascade,
  email           text                      not null,
  role            public.workspace_role     not null,
  token           text                      not null unique,
  status          public.invitation_status  not null default 'pending',
  expires_at      timestamptz               not null,
  invited_by      uuid                      not null references auth.users(id) on delete cascade,
  created_at      timestamptz               not null default now()
);

comment on table public.workspace_invitations is
  'Email invitations to join a vendor workspace. Token is a 64-char hex secret.';

create index if not exists workspace_invitations_workspace_id_idx
  on public.workspace_invitations(workspace_id);
create index if not exists workspace_invitations_token_idx
  on public.workspace_invitations(token);
create index if not exists workspace_invitations_email_status_idx
  on public.workspace_invitations(email, status);


-- ============================================================
-- 3. ORDER_ASSIGNMENTS
--    One active assignment per order (upsert on order_id conflict).
-- ============================================================

create table if not exists public.order_assignments (
  id              uuid        primary key default uuid_generate_v4(),
  order_id        uuid        not null references public.orders(id)    on delete cascade,
  assigned_to     uuid        not null references auth.users(id)       on delete cascade,
  assigned_by     uuid        not null references auth.users(id)       on delete cascade,
  reason          text,
  created_at      timestamptz not null default now(),

  -- Enforce one active assignment per order
  unique (order_id)
);

comment on table public.order_assignments is
  'Active assignment for an order: which team member is responsible.';

create index if not exists order_assignments_assigned_to_idx
  on public.order_assignments(assigned_to);


-- ============================================================
-- 4. ACTIVITY_LOGS
--    Immutable audit trail. Never deleted or updated.
-- ============================================================

create table if not exists public.activity_logs (
  id              uuid        primary key default uuid_generate_v4(),
  workspace_id    uuid        not null references public.users(id) on delete cascade,
  actor_id        uuid        references auth.users(id) on delete set null,
  entity_type     text        not null,
  entity_id       uuid,
  action          text        not null,
  meta            jsonb       not null default '{}',
  created_at      timestamptz not null default now()
  -- No updated_at: rows are write-once
);

comment on table public.activity_logs is
  'Immutable audit trail for all business events across a workspace.';

create index if not exists activity_logs_workspace_id_idx
  on public.activity_logs(workspace_id);
create index if not exists activity_logs_workspace_created_idx
  on public.activity_logs(workspace_id, created_at desc);
create index if not exists activity_logs_entity_idx
  on public.activity_logs(entity_type, entity_id);
create index if not exists activity_logs_actor_idx
  on public.activity_logs(actor_id);


-- ============================================================
-- 5. JOB_QUEUE
--    Lightweight background job queue with exponential backoff.
-- ============================================================

create table if not exists public.job_queue (
  id              uuid              primary key default uuid_generate_v4(),
  queue_name      text              not null,
  payload         jsonb             not null default '{}',
  status          public.job_status not null default 'queued',
  attempts        integer           not null default 0,
  max_attempts    integer           not null default 8,
  run_at          timestamptz       not null default now(),
  last_error      text,
  created_at      timestamptz       not null default now(),
  updated_at      timestamptz       not null default now()
);

comment on table public.job_queue is
  'Durable background job queue. Workers poll and claim jobs with optimistic locking.';

-- Primary index for the worker claim query
create index if not exists job_queue_claim_idx
  on public.job_queue(queue_name, status, run_at)
  where status in ('queued', 'failed');

create index if not exists job_queue_status_idx
  on public.job_queue(status);

drop trigger if exists trg_job_queue_updated_at on public.job_queue;
create trigger trg_job_queue_updated_at
  before update on public.job_queue
  for each row execute function public.set_updated_at();


-- ============================================================
-- 6. AUTOMATION_RULES
--    User-defined trigger → action automation rules.
-- ============================================================

create table if not exists public.automation_rules (
  id                uuid                      primary key default uuid_generate_v4(),
  workspace_id      uuid                      not null references public.users(id) on delete cascade,
  name              text                      not null,
  trigger           public.automation_trigger not null,
  conditions        jsonb                     not null default '{}',
  actions           jsonb                     not null default '[]',
  cooldown_seconds  integer                   not null default 0 check (cooldown_seconds >= 0),
  is_active         boolean                   not null default true,
  created_at        timestamptz               not null default now(),
  updated_at        timestamptz               not null default now()
);

comment on table public.automation_rules is
  'User-defined automation rules evaluated on business events (order created, status changed, etc.).';

create index if not exists automation_rules_workspace_trigger_idx
  on public.automation_rules(workspace_id, trigger)
  where is_active = true;

drop trigger if exists trg_automation_rules_updated_at on public.automation_rules;
create trigger trg_automation_rules_updated_at
  before update on public.automation_rules
  for each row execute function public.set_updated_at();


-- ============================================================
-- 7. AUTOMATION_RUNS
--    Execution audit trail for each rule evaluation.
-- ============================================================

create table if not exists public.automation_runs (
  id              uuid                          primary key default uuid_generate_v4(),
  workspace_id    uuid                          not null references public.users(id)       on delete cascade,
  rule_id         uuid                          not null references public.automation_rules(id) on delete cascade,
  entity_type     text                          not null,
  entity_id       uuid,
  status          public.automation_run_status  not null default 'running',
  error           text,
  meta            jsonb                         not null default '{}',
  created_at      timestamptz                   not null default now()
);

comment on table public.automation_runs is
  'One row per automation rule evaluation — records skip/succeed/fail outcome.';

create index if not exists automation_runs_workspace_id_idx
  on public.automation_runs(workspace_id);
create index if not exists automation_runs_rule_id_idx
  on public.automation_runs(rule_id);
-- For cooldown queries: find recent runs for a workspace+rule
create index if not exists automation_runs_rule_created_idx
  on public.automation_runs(rule_id, created_at desc);


-- ============================================================
-- 8. INBOUND_MESSAGE_EVENTS
--    Raw inbound WhatsApp messages from the Meta Cloud API.
-- ============================================================

create table if not exists public.inbound_message_events (
  id                  uuid                    primary key default uuid_generate_v4(),
  workspace_id        uuid                    not null references public.users(id) on delete cascade,
  provider            public.message_provider not null default 'meta_whatsapp',
  provider_message_id text                    not null,
  from_phone          text                    not null,
  to_phone            text                    not null,
  message_type        text                    not null default 'text',
  message_text        text,
  payload             jsonb                   not null default '{}',
  created_at          timestamptz             not null default now(),

  -- Idempotency: same provider+message can only be inserted once
  unique (provider, provider_message_id)
);

comment on table public.inbound_message_events is
  'Raw inbound WhatsApp messages. Idempotent on (provider, provider_message_id).';

create index if not exists inbound_message_events_workspace_id_idx
  on public.inbound_message_events(workspace_id);
create index if not exists inbound_message_events_from_phone_idx
  on public.inbound_message_events(workspace_id, from_phone);
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'inbound_message_events'
      and column_name = 'created_at'
  ) then
    execute 'create index if not exists inbound_message_events_created_idx on public.inbound_message_events(workspace_id, created_at desc)';
  end if;
end $$;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.workspace_members        enable row level security;
alter table public.workspace_invitations    enable row level security;
alter table public.order_assignments        enable row level security;
alter table public.activity_logs            enable row level security;
alter table public.job_queue                enable row level security;
alter table public.automation_rules         enable row level security;
alter table public.automation_runs          enable row level security;
alter table public.inbound_message_events   enable row level security;

create or replace function public.my_vendor_id()
returns uuid language sql stable security definer as $$
  select auth.uid()
$$;


-- ── workspace_members ────────────────────────────────────────────────────────

-- Workspace owner can do anything
drop policy if exists "workspace_members: owner all" on public.workspace_members;
create policy "workspace_members: owner all" on public.workspace_members
  for all using (workspace_id = auth.uid());

-- Members can read their own row
drop policy if exists "workspace_members: self read" on public.workspace_members;
create policy "workspace_members: self read" on public.workspace_members
  for select using (user_id = auth.uid());


-- ── workspace_invitations ────────────────────────────────────────────────────

-- Only the workspace owner can manage invitations
drop policy if exists "workspace_invitations: owner all" on public.workspace_invitations;
create policy "workspace_invitations: owner all" on public.workspace_invitations
  for all using (workspace_id = auth.uid());


-- ── order_assignments ────────────────────────────────────────────────────────

-- Orders belong to a vendor; assignment accessible to that vendor (workspace owner)
drop policy if exists "order_assignments: vendor scope" on public.order_assignments;
create policy "order_assignments: vendor scope" on public.order_assignments
  for all using (
    order_id in (
      select id from public.orders where vendor_id = public.my_vendor_id()
    )
  );


-- ── activity_logs ────────────────────────────────────────────────────────────

-- Workspace owner can read their audit log
drop policy if exists "activity_logs: owner read" on public.activity_logs;
create policy "activity_logs: owner read" on public.activity_logs
  for select using (workspace_id = auth.uid());

-- No direct user inserts — all writes go through the service-role client (lib/activity.ts)


-- ── job_queue ────────────────────────────────────────────────────────────────

-- No direct user access — all access is via service-role (lib/jobs.ts)
-- Enabling RLS with no user policies means only the service-role key can access it.


-- ── automation_rules ─────────────────────────────────────────────────────────

drop policy if exists "automation_rules: owner all" on public.automation_rules;
create policy "automation_rules: owner all" on public.automation_rules
  for all using (workspace_id = auth.uid());


-- ── automation_runs ──────────────────────────────────────────────────────────

-- Owner can read runs for their workspace
drop policy if exists "automation_runs: owner read" on public.automation_runs;
create policy "automation_runs: owner read" on public.automation_runs
  for select using (workspace_id = auth.uid());

-- No direct inserts/updates from user JWT — all via service-role (lib/automation.ts)


-- ── inbound_message_events ───────────────────────────────────────────────────

drop policy if exists "inbound_message_events: owner read" on public.inbound_message_events;
create policy "inbound_message_events: owner read" on public.inbound_message_events
  for select using (workspace_id = auth.uid());



-- ============================================================
-- 9. ORDER_DRAFTS
--    AI-parsed order drafts awaiting staff review before conversion.
-- ============================================================

do $$ begin
  create type public.draft_status as enum (
    'pending_review', 'approved', 'rejected', 'converted'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.order_drafts (
  id                  uuid                    primary key default uuid_generate_v4(),
  workspace_id        uuid                    not null references public.users(id) on delete cascade,
  inbound_message_id  uuid                    references public.inbound_message_events(id) on delete set null,
  customer_phone      text                    not null,
  customer_name       text,
  items               jsonb                   not null default '[]',
  notes               text,
  confidence          numeric(4,3)            check (confidence >= 0 and confidence <= 1),
  status              public.draft_status     not null default 'pending_review',
  reviewed_by         uuid                    references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  created_order_id    uuid                    references public.orders(id) on delete set null,
  created_at          timestamptz             not null default now()
);

comment on table public.order_drafts is
  'AI-parsed inbound order drafts pending staff review. Linked to the originating inbound message.';

create index if not exists order_drafts_workspace_status_idx
  on public.order_drafts(workspace_id, status);
create index if not exists order_drafts_inbound_msg_idx
  on public.order_drafts(inbound_message_id);


-- ============================================================
-- 10. PRODUCT_ALIASES
--     Alternative names for products used in AI order parsing.
-- ============================================================

create table if not exists public.product_aliases (
  id              uuid        primary key default uuid_generate_v4(),
  workspace_id    uuid        not null references public.users(id)    on delete cascade,
  product_id      uuid        not null references public.products(id) on delete cascade,
  alias           text        not null,   -- normalised lowercase
  created_at      timestamptz not null default now(),

  unique (workspace_id, alias)
);

comment on table public.product_aliases is
  'Alternative product name aliases used by the AI parser to match customer messages to catalogue items.';

create index if not exists product_aliases_workspace_id_idx
  on public.product_aliases(workspace_id);
create index if not exists product_aliases_product_id_idx
  on public.product_aliases(product_id);


-- ============================================================
-- 11. AI_PARSE_ATTEMPTS
--     Log of every OpenAI parse attempt for inbound messages.
-- ============================================================

do $$ begin
  create type public.parse_status as enum (
    'parsed', 'needs_review', 'failed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.ai_parse_attempts (
  id                  uuid                  primary key default uuid_generate_v4(),
  inbound_message_id  uuid                  not null references public.inbound_message_events(id) on delete cascade,
  workspace_id        uuid                  not null references public.users(id) on delete cascade,
  model               text                  not null,
  confidence          numeric(4,3)          not null check (confidence >= 0 and confidence <= 1),
  status              public.parse_status   not null,
  structured_output   jsonb                 not null default '{}',
  error               text,
  created_at          timestamptz           not null default now()
);

comment on table public.ai_parse_attempts is
  'Audit log of every AI parse run for an inbound WhatsApp message — records model, confidence, and structured output.';

create index if not exists ai_parse_attempts_workspace_id_idx
  on public.ai_parse_attempts(workspace_id);
create index if not exists ai_parse_attempts_message_id_idx
  on public.ai_parse_attempts(inbound_message_id);


-- ── RLS for new tables ────────────────────────────────────────────────────────

alter table public.order_drafts         enable row level security;
alter table public.product_aliases      enable row level security;
alter table public.ai_parse_attempts    enable row level security;

-- order_drafts: workspace owner full access
drop policy if exists "order_drafts: owner all" on public.order_drafts;
create policy "order_drafts: owner all" on public.order_drafts
  for all using (workspace_id = auth.uid());

-- product_aliases: workspace owner full access
drop policy if exists "product_aliases: owner all" on public.product_aliases;
create policy "product_aliases: owner all" on public.product_aliases
  for all using (workspace_id = auth.uid());

-- ai_parse_attempts: owner read only; writes via service-role
drop policy if exists "ai_parse_attempts: owner read" on public.ai_parse_attempts;
create policy "ai_parse_attempts: owner read" on public.ai_parse_attempts
  for select using (workspace_id = auth.uid());
