# WhatsApp Commerce SaaS - Production Implementation Blueprint

This blueprint converts strategy into implementable work for:
- Team collaboration with roles: Owner, Staff, Delivery Manager
- AI order capture from inbound WhatsApp messages
- Automation engine (order, payment, delivery notifications/reminders)
- Production readiness (security, reliability, observability)

---

## 1) Architecture Direction (Target State)

## Core bounded contexts
1. Identity and Access
2. Commerce (customers, products, orders, order_items)
3. Messaging (inbound events, outbound events, templates, campaigns)
4. Payments (provider adapters + reconciliation)
5. Delivery Operations
6. Automation Rules Engine
7. Analytics and Metering

## System shape
1. Next.js app for dashboard and settings
2. Supabase Postgres as source of truth (RLS enforced)
3. Async jobs layer for webhook processing, outbound WhatsApp sends, retries
4. AI parsing service for message-to-order extraction (can start in-app, later externalized)

## Mandatory production principles
1. Every webhook endpoint is idempotent
2. Every async job has retries + dead letter handling
3. Every privileged action is audited with actor_id and timestamp
4. Every workspace action is permission-gated by role and RLS

---

## 2) Supabase Migration Plan (SQL Specs)

Create these migrations in order.

## Migration 005 - Team Collaboration and RBAC

```sql
-- 005_team_rbac.sql

-- Roles
create type public.workspace_role as enum ('owner', 'staff', 'delivery_manager');

-- Workspace members
create table public.workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  is_active boolean not null default true,
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- Team invitations
create table public.workspace_invitations (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  email text not null,
  role public.workspace_role not null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Order assignment
create table public.order_assignments (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  assigned_to uuid not null references auth.users(id),
  assigned_by uuid not null references auth.users(id),
  reason text,
  created_at timestamptz not null default now(),
  unique (order_id)
);

-- Activity log
create table public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index workspace_members_workspace_idx on public.workspace_members(workspace_id);
create index workspace_members_user_idx on public.workspace_members(user_id);
create index order_assignments_order_idx on public.order_assignments(order_id);
create index activity_logs_workspace_created_idx on public.activity_logs(workspace_id, created_at desc);
```

## Migration 006 - Role Permission Helpers and RLS Updates

```sql
-- 006_rbac_policies.sql

create or replace function public.my_workspace_id()
returns uuid language sql stable security definer as $$
  select u.id
  from public.users u
  where u.id = auth.uid()
  union
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id = auth.uid() and wm.is_active = true
  limit 1
$$;

create or replace function public.my_workspace_role()
returns public.workspace_role language sql stable security definer as $$
  select 'owner'::public.workspace_role
  where exists (select 1 from public.users u where u.id = auth.uid())
  union
  select wm.role
  from public.workspace_members wm
  where wm.user_id = auth.uid() and wm.is_active = true
  limit 1
$$;

-- Example replacement policy pattern for orders
alter table public.orders enable row level security;
drop policy if exists "orders: vendor scope" on public.orders;
create policy "orders: workspace read" on public.orders
  for select using (vendor_id = public.my_workspace_id());

create policy "orders: workspace write" on public.orders
  for insert with check (
    vendor_id = public.my_workspace_id()
    and public.my_workspace_role() in ('owner','staff')
  );

create policy "orders: workspace update" on public.orders
  for update using (
    vendor_id = public.my_workspace_id()
    and public.my_workspace_role() in ('owner','staff','delivery_manager')
  ) with check (
    vendor_id = public.my_workspace_id()
  );
```

Note: Apply same pattern to customers/products/payments/deliveries with stricter delivery_manager write scope where needed.

## Migration 007 - Inbound WhatsApp and AI Order Capture

```sql
-- 007_inbound_ai_capture.sql

create type public.message_direction as enum ('inbound','outbound');
create type public.parse_status as enum ('pending','parsed','needs_review','failed');

create table public.inbound_message_events (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'meta_whatsapp',
  provider_message_id text not null,
  from_phone text not null,
  to_phone text not null,
  message_type text not null default 'text',
  message_text text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  unique (provider, provider_message_id)
);

create table public.ai_parse_attempts (
  id uuid primary key default uuid_generate_v4(),
  inbound_message_id uuid not null references public.inbound_message_events(id) on delete cascade,
  workspace_id uuid not null references public.users(id) on delete cascade,
  model text not null,
  confidence numeric(5,4),
  status public.parse_status not null default 'pending',
  structured_output jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table public.order_drafts (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  inbound_message_id uuid references public.inbound_message_events(id) on delete set null,
  customer_phone text not null,
  customer_name text,
  items jsonb not null default '[]',
  notes text,
  confidence numeric(5,4),
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','converted')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_order_id uuid references public.orders(id),
  created_at timestamptz not null default now()
);

create table public.product_aliases (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, alias)
);
```

## Migration 008 - Automation Engine

```sql
-- 008_automation_engine.sql

create type public.automation_trigger as enum (
  'order_created',
  'order_status_changed',
  'payment_pending',
  'payment_confirmed',
  'delivery_status_changed',
  'no_customer_response'
);

create table public.automation_rules (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  trigger public.automation_trigger not null,
  conditions jsonb not null default '{}',
  actions jsonb not null default '[]',
  is_active boolean not null default true,
  cooldown_seconds int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  status text not null check (status in ('queued','running','succeeded','failed','skipped')),
  error text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index automation_rules_workspace_trigger_idx on public.automation_rules(workspace_id, trigger);
create index automation_runs_workspace_created_idx on public.automation_runs(workspace_id, created_at desc);
```

## Migration 009 - Delivery Ops and Inventory Enhancements

```sql
-- 009_delivery_inventory.sql

alter table public.products
  add column if not exists stock_quantity int,
  add column if not exists low_stock_threshold int default 5,
  add column if not exists track_inventory boolean not null default false;

create table public.stock_movements (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  delta int not null,
  reason text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.deliveries
  add column if not exists assigned_to uuid references auth.users(id),
  add column if not exists proof_of_delivery_url text,
  add column if not exists failed_reason text;
```

---

## 3) API Contracts (Production Ready)

## A. WhatsApp inbound webhook
- Endpoint: POST /api/whatsapp/webhook
- Purpose: accept inbound customer messages

Request (provider payload passthrough):
```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "id": "wamid.XXX",
                "from": "2348012345678",
                "timestamp": "1711111111",
                "type": "text",
                "text": { "body": "I want 2 shawarma and 1 coke" }
              }
            ],
            "metadata": { "display_phone_number": "2348011122233" }
          }
        }
      ]
    }
  ]
}
```

Processing contract:
1. Verify provider signature
2. Idempotency check by provider_message_id
3. Save inbound event
4. Queue parse job
5. Return 200 immediately

## B. AI parse endpoint (internal)
- Endpoint: POST /internal/ai/parse-order

Request:
```json
{
  "workspace_id": "uuid",
  "message": "I want 2 shawarma and 1 coke",
  "customer_phone": "2348012345678",
  "catalog": [
    { "id": "uuid", "name": "Chicken Shawarma", "aliases": ["shawarma"] },
    { "id": "uuid", "name": "Coke", "aliases": ["coca cola"] }
  ]
}
```

Response:
```json
{
  "status": "parsed",
  "confidence": 0.91,
  "items": [
    { "product_id": "uuid", "product_name": "Chicken Shawarma", "quantity": 2 },
    { "product_id": "uuid", "product_name": "Coke", "quantity": 1 }
  ],
  "missing_fields": [],
  "clarification_question": null
}
```

Rules:
1. confidence >= 0.85 -> auto create order
2. 0.55 <= confidence < 0.85 -> create order_draft, request staff approval
3. confidence < 0.55 -> auto-ask clarification to customer

## C. Draft review API
- Endpoint: POST /api/orders/drafts/{id}/review
- Body: { decision: "approve" | "reject", notes?: string }

Approval effect:
1. create customer/order/order_items
2. set draft status converted
3. emit order_created event to automation engine

## D. Team invitation API
- Endpoint: POST /api/team/invitations
- Body: { email, role }
- Owner only

## E. Assignment API
- Endpoint: POST /api/orders/{id}/assign
- Body: { assigned_to_user_id, reason? }
- Owner/staff can assign, delivery_manager can assign only within delivery queue

---

## 4) Permission Matrix (Minimum)

| Capability | Owner | Staff | Delivery Manager |
|---|---|---|---|
| Billing and plan | Yes | No | No |
| Team invites/roles | Yes | No | No |
| Create/update products | Yes | Yes | No |
| Create/update orders | Yes | Yes | Limited (delivery fields) |
| Move order status to shipped/delivered | Yes | Yes | Yes |
| View payment records | Yes | Yes | Read only |
| Mark payment manual paid/refund | Yes | No | No |
| Assign orders | Yes | Yes | Delivery queue only |
| Broadcast campaigns | Yes | Yes (if granted) | No |
| Automation rule editing | Yes | No (phase 1) | No |
| View analytics | Yes | Yes | Delivery analytics only |

---

## 5) Automation Templates to Ship First

1. Order received confirmation
- Trigger: order_created
- Action: send WhatsApp template "order_received"

2. Payment reminder
- Trigger: payment_pending 30 minutes after order_created
- Condition: payment_status != paid
- Action: send payment link reminder

3. Delivery dispatch update
- Trigger: order_status_changed to shipped
- Action: send shipped/tracking message

4. Delivered follow-up
- Trigger: order_status_changed to delivered
- Action: send thank-you + review request + reorder link

5. Stale order escalation
- Trigger: no_customer_response for 24h
- Action: assign to owner + internal note + optional customer ping

---

## 6) Event and Queue Design

Use a durable jobs table if no external queue yet.

```sql
create table public.job_queue (
  id uuid primary key default uuid_generate_v4(),
  queue_name text not null,
  payload jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','done','failed','dead')),
  attempts int not null default 0,
  max_attempts int not null default 8,
  run_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_queue_status_run_at_idx on public.job_queue(status, run_at);
```

Retry strategy:
1. Exponential backoff: 30s, 2m, 10m, 30m, 2h...
2. Move to dead after max attempts
3. Alert on dead jobs > threshold

---

## 7) Non-Functional Requirements Checklist

## Security
1. Signature validation for all webhooks
2. Role checks in server actions and API routes
3. Strict RLS coverage for all tables
4. Audit logs for status/payment/team/billing changes

## Reliability
1. Idempotency keys for webhook and outbound sends
2. Queue + retry + dead letter
3. Outbound message failure reporting

## Observability
1. Correlation IDs across webhook -> parse -> order creation
2. Metrics: parse success rate, auto-order rate, payment success latency
3. Alerts: webhook failures, queue backlog, payment mismatch

## Testing
1. Contract tests for inbound webhook payloads
2. Integration tests for parse thresholds and draft flow
3. End-to-end tests for order -> payment -> delivery automations

---

## 8) 12-Week Delivery Plan (Tickets)

## Sprint 1 (Weeks 1-2): RBAC Foundation
1. Add workspace_members + invitations + assignment tables
2. Implement invite, accept, revoke endpoints
3. Update dashboard UI for team management
4. Add role-aware route guards and server checks

## Sprint 2 (Weeks 3-4): RLS and Audit Hardening
1. Replace vendor-only policies with workspace-role policies
2. Add activity_logs on critical write paths
3. Add assignment UI to order board/order detail
4. Add QA matrix for role permissions

## Sprint 3 (Weeks 5-6): Inbound WhatsApp Capture
1. Create inbound webhook endpoint with signature verification
2. Persist inbound_message_events idempotently
3. Add parse job worker and ai_parse_attempts table
4. Build order_drafts review UI

## Sprint 4 (Weeks 7-8): Auto Order Conversion
1. Build product matching with aliases
2. Add confidence threshold routing
3. Auto create order when high confidence
4. Clarification message templates for low confidence

## Sprint 5 (Weeks 9-10): Automation Engine v1
1. Add automation_rules and automation_runs tables
2. Ship 5 default automations
3. Add simple rule management UI
4. Queue-based execution with retries

## Sprint 6 (Weeks 11-12): Delivery and Launch Hardening
1. Add delivery assignment + proof of delivery
2. Add inventory stock and low-stock alerts
3. Add observability dashboards + alerting
4. Pilot launch with 5-10 vendors and measure activation

---

## 9) Activation and KPI Targets

Primary north-star:
- Percent of inbound customer messages converted to orders

First 90-day KPI targets:
1. Auto-capture precision >= 90% on high-confidence path
2. Median time-to-order-confirmation < 3 minutes
3. Payment pending->paid conversion uplift >= 20%
4. Weekly active staff users per workspace >= 2
5. Broadcast campaign attributable revenue tracked per send

---

## 10) Suggested Immediate Next Actions (This Week)

1. Implement Migration 005 and team invitation backend first
2. Add role checks to existing order update and product actions
3. Create inbound webhook endpoint skeleton with event persistence
4. Add order_drafts table and approval UI scaffold
5. Add activity log writes to order status updates and payment updates

When these are done, AI capture and automation can be added with lower risk and faster release speed.
