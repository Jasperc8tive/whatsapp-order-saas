-- ============================================================
--  Migration 005 — Team Collaboration & RBAC
--  Run once against your Supabase project.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Workspace role enum
create type public.workspace_role as enum ('owner', 'staff', 'delivery_manager');

-- ── Workspace members ─────────────────────────────────────────────────────────
-- owner row is also inserted here so all permission checks go through one table
create table public.workspace_members (
  id           uuid                   primary key default gen_random_uuid(),
  workspace_id uuid                   not null references public.users(id) on delete cascade,
  user_id      uuid                   not null references auth.users(id)  on delete cascade,
  role         public.workspace_role  not null,
  display_name text,
  is_active    boolean                not null default true,
  invited_by   uuid                   references auth.users(id),
  created_at   timestamptz            not null default now(),
  updated_at   timestamptz            not null default now(),
  unique (workspace_id, user_id)
);

-- ── Team invitations ──────────────────────────────────────────────────────────
create table public.workspace_invitations (
  id           uuid                   primary key default gen_random_uuid(),
  workspace_id uuid                   not null references public.users(id) on delete cascade,
  email        text                   not null,
  role         public.workspace_role  not null,
  token        text                   not null unique,
  status       text                   not null default 'pending'
                 check (status in ('pending','accepted','revoked','expired')),
  expires_at   timestamptz            not null,
  invited_by   uuid                   not null references auth.users(id),
  created_at   timestamptz            not null default now()
);

-- ── Order assignments ─────────────────────────────────────────────────────────
create table public.order_assignments (
  id          uuid  primary key default gen_random_uuid(),
  order_id    uuid  not null references public.orders(id)    on delete cascade,
  assigned_to uuid  not null references auth.users(id),
  assigned_by uuid  not null references auth.users(id),
  reason      text,
  created_at  timestamptz not null default now(),
  unique (order_id)
);

-- ── Immutable activity log ────────────────────────────────────────────────────
create table public.activity_logs (
  id           uuid   primary key default gen_random_uuid(),
  workspace_id uuid   not null references public.users(id) on delete cascade,
  actor_id     uuid   references auth.users(id),
  entity_type  text   not null,
  entity_id    uuid,
  action       text   not null,
  meta         jsonb  not null default '{}',
  created_at   timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index workspace_members_workspace_idx  on public.workspace_members(workspace_id);
create index workspace_members_user_idx       on public.workspace_members(user_id);
create index workspace_invites_workspace_idx  on public.workspace_invitations(workspace_id);
create index workspace_invites_token_idx      on public.workspace_invitations(token);
create index order_assignments_order_idx      on public.order_assignments(order_id);
create index order_assignments_user_idx       on public.order_assignments(assigned_to);
create index activity_logs_workspace_idx      on public.activity_logs(workspace_id, created_at desc);
create index activity_logs_entity_idx         on public.activity_logs(entity_type, entity_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_workspace_members_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.workspace_members    enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.order_assignments     enable row level security;
alter table public.activity_logs         enable row level security;

-- Members: visible to any authenticated member of the same workspace
create policy "workspace_members: select by member" on public.workspace_members
  for select using (
    workspace_id = auth.uid()
    or
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_members.workspace_id
      and   wm2.user_id      = auth.uid()
      and   wm2.is_active    = true
    )
  );

-- Only owner can insert/update members
create policy "workspace_members: owner manage" on public.workspace_members
  for all using (
    workspace_id = auth.uid()
    or
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_members.workspace_id
      and   wm2.user_id      = auth.uid()
      and   wm2.role         = 'owner'
      and   wm2.is_active    = true
    )
  );

-- Invitations: owner only
create policy "workspace_invitations: owner manage" on public.workspace_invitations
  for all using (
    workspace_id = auth.uid()
    or
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_invitations.workspace_id
      and   wm.user_id      = auth.uid()
      and   wm.role         = 'owner'
      and   wm.is_active    = true
    )
  );

-- Invitations: any authenticated user can read their own invite by token (for accept flow)
create policy "workspace_invitations: public read by token" on public.workspace_invitations
  for select using (true);

-- Order assignments: workspace members can read/write
create policy "order_assignments: workspace access" on public.order_assignments
  for all using (
    exists (
      select 1 from public.orders o
      join   public.workspace_members wm
        on   wm.workspace_id = o.vendor_id
       and   wm.user_id      = auth.uid()
       and   wm.is_active    = true
      where  o.id = order_assignments.order_id
    )
  );

-- Activity logs: read by workspace members, insert only via service role
create policy "activity_logs: workspace read" on public.activity_logs
  for select using (
    workspace_id = auth.uid()
    or
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = activity_logs.workspace_id
      and   wm.user_id      = auth.uid()
      and   wm.is_active    = true
    )
  );
