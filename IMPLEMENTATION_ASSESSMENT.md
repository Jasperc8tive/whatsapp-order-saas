# WhatsApp Business OS — Deep Audit & Strategic Upgrade Roadmap

> **Project:** WhatsOrder / OrderFlow  
> **Stack:** Next.js 14 · Supabase · Paystack · Meta WhatsApp Cloud API · TypeScript · Tailwind CSS  
> **Assessment Date:** March 21, 2026  
> **Target Market:** Nigerian Instagram sellers, fashion vendors, restaurants, wholesalers

---

## Part 1 — Current Reality: What You Have vs. What You Need

After reading every single file in the codebase, here is the honest picture.

### What Is Production-Ready Right Now ✅

| Feature | Notes |
| --- | --- |
| Email/password auth with email confirmation + PKCE callback | Correctly implemented |
| Multi-tenant isolation via Supabase RLS | All 7 tables fully protected |
| Storefront order submission with plan limit enforcement | `/order/[vendor]` path only |
| Drag-and-drop kanban with optimistic updates + rollback | `KanbanBoard` component |
| Dashboard analytics (4 stat cards + WoW deltas + recent orders) | `lib/analytics.ts` |
| Paystack payment init + webhook HMAC verification | Timing-attack safe |
| 3 WhatsApp notification types (order created, paid, shipped) | Fire-and-forget |
| DB schema with triggers, enums, indexes, and RLS policies | Solid backbone |

This is a well-architected core. The backend is production-safe. What is missing is the **product layer** — the things vendors actually open the dashboard for every day.

---

### The Critical Bugs (Breaking Right Now) 🔴

These must be fixed **before** any new feature work. They create active data corruption.

#### Bug #1 — Dual Storefront Routes (Data Integrity)

Two storefront routes co-exist with **incompatible schemas**:

- `/order/[vendor]` — uses `order_items` table, plan enforcement, Server Actions ✅
- `/store/[slug]` — legacy client component, flat schema (`customer_name`, `product`, `quantity` on `orders` directly), no `order_items`, no plan enforcement ❌

Orders from `/store/[slug]` appear as ₦0 forever on the kanban because they have no `order_items` rows. The DB trigger that calculates `total_amount` never fires.

#### Bug #2 — Dual Kanban Implementations (Wrong Status Data)

`KanbanBoard` uses `OrderStatus`: `pending | confirmed | processing | shipped | delivered | cancelled`  
`OrderBoard` (on the main overview page) uses `KanbanStatus`: `new | paid | processing | shipped | delivered`

An order dragged to "confirmed" on the orders page will never show in the "paid" column on the overview. The overview dashboard shows stale/incorrect order status data.

#### Bug #3 — Settings Page Loads Mock Data, Not Real Data

`app/dashboard/settings/page.tsx` initializes state with **hardcoded strings** (`"My Food Store"`, `"my-food-store"`). It never fetches the real vendor data on mount. Every time a vendor opens Settings and saves, they overwrite their real business name with mock values.

Additionally, the page writes to an `api_token` column that does not exist in `schema.sql`.

#### Bug #4 — Missing Password Reset Page (404 on Login)

The LoginForm has a "Forgot password?" link → `/forgot-password`. This page does not exist. Users who forget their password get a 404, which looks like a broken product to paying customers.

#### Bug #5 — NewOrderModal Bypasses order_items

When a vendor manually adds an order from the dashboard, `NewOrderModal` inserts into the flat `orders` schema without creating `order_items` rows. Those orders show ₦0 total permanently and are invisible in the proper KanbanBoard.

---

### Schema / Type Drift ⚠️

- `types/customer.ts` defines `total_orders`, `total_spent`, `last_order_at` — none of these columns exist in the actual `customers` table in the DB
- `types/vendor.ts` exists but is unused everywhere — app reads vendor data with loose inline types
- Settings page references `api_token` — not in schema
- `KanbanStatus` and `OrderStatus` are two parallel status systems that should be one

---

## Part 2 — Phase 1: Foundation Repairs (Week 1)

*These make the app correct. Nothing else should be built until these are done.*

### 1.1 — Fix the Dual Storefront Problem

**Delete** `app/store/[slug]/page.tsx`  
**Add** a permanent redirect in `next.config.mjs`:

```javascript
// next.config.mjs
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/store/:slug',
        destination: '/order/:slug',
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
```

All existing `/store/` links continue to work via redirect.

---

### 1.2 — Remove the Legacy Kanban

**Delete:** `components/OrderBoard.tsx`, `components/OrderCard.tsx`, `components/OrderColumn.tsx`

**Update** `app/dashboard/page.tsx` to show a read-only recent orders table instead of the legacy `<OrderBoard />`. The full interactive kanban lives on `/dashboard/orders` only.

---

### 1.3 — Fix Settings Page

Convert to the proper Next.js App Router pattern:

```
app/dashboard/settings/
  page.tsx         ← Server Component: fetch real vendor row, pass as props
  SettingsForm.tsx ← "use client" component: receives initialData, handles saves
```

Add `api_token` properly to the DB schema OR remove the field from the UI:

```sql
-- supabase/migrations/003_settings_fields.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_token text UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Africa/Lagos';
```

---

### 1.4 — Add Password Reset Pages

Two new pages:

- `app/(auth)/forgot-password/page.tsx` — email input, calls `supabase.auth.resetPasswordForEmail()`
- `app/(auth)/reset-password/page.tsx` — new password input, calls `supabase.auth.updateUser({ password })`

Set `emailRedirectTo` in the Supabase dashboard to point to `/auth/callback?next=/reset-password`.

---

### 1.5 — Fix NewOrderModal to Use order_items

The modal must:

1. Accept multiple line items (product name + qty + unit price fields)
2. Insert rows into `order_items`, not the flat `orders` schema
3. Call `checkPlanLimit` before inserting
4. Let the DB trigger calculate `total_amount` from items automatically

---

### 1.6 — Fix Customer Type / Schema Drift

Add a Postgres view that computes the stats `types/customer.ts` already expects:

```sql
-- supabase/migrations/003_customer_stats_view.sql
CREATE OR REPLACE VIEW customer_stats AS
SELECT
  c.id,
  c.vendor_id,
  c.name,
  c.phone,
  c.email,
  c.address,
  c.created_at,
  COUNT(o.id)::int                                                              AS total_orders,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.payment_status = 'paid'), 0)   AS total_spent,
  MAX(o.created_at)                                                             AS last_order_at
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id AND o.vendor_id = c.vendor_id
GROUP BY c.id;
```

Then update the customers page to query `customer_stats` instead of `customers`.

---

## Part 3 — Phase 2: Core Product Completion (Weeks 2–3)

*Features vendors expect on Day 1 of using any SaaS dashboard.*

### 2.1 — Product Catalogue (Biggest Quick Win)

**The Problem:** Customers type free-text product names on the storefront. This causes:

- Spelling errors (same product ordered 10 different ways in analytics)
- No price visibility for customers before they order
- Vendors cannot see what's actually selling

The `products` table already exists fully in `schema.sql` — it just has zero UI.

**Build:**

```text
app/dashboard/products/
  page.tsx              ← Product list grid with "Add Product" button
  ProductForm.tsx       ← Client form: name, description, price, image, active toggle

lib/actions/
  products.ts           ← createProduct, updateProduct, toggleProductActive Server Actions

components/
  ProductCard.tsx       ← Product tile with image, name, price, stock badge, edit/archive controls
```

**DB additions needed:**

```sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_count integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku text UNIQUE;
```

**Storefront integration:**  
Update `components/storefront/OrderForm.tsx` to load the vendor's active products and show them as tappable cards with names and prices. Keep a "custom item" free-text option for unlisted products.

**Impact on analytics:** Once products have real prices, `total_amount` will be accurate from creation, and product-level revenue reporting becomes possible.

---

### 2.2 — Order Detail Page

Vendors cannot drill into an individual order. There is no `/dashboard/orders/[id]`.

**Build:**

```
app/dashboard/orders/[id]/
  page.tsx              ← Server Component: full order view

components/
  OrderTimeline.tsx     ← Visual status history: pending → confirmed → shipped → delivered
  OrderItemsTable.tsx   ← Line items with qty, unit price, subtotal
  DeliveryCard.tsx      ← Courier, tracking ID, dispatch date, delivery date
```

**Features:**

- All order line items with names, quantities, and unit prices
- Customer info card with a direct `wa.me` deep link to chat on WhatsApp
- Status changer (same `updateOrderStatus` action, faster than finding the card on the kanban)
- Add/edit delivery details (courier name, tracking ID)
- Payment status + Paystack reference number
- "Mark as paid manually" button for cash-on-delivery orders
- "Resend notification" button to re-fire the WhatsApp message

---

### 2.3 — Delivery Management

The `deliveries` table is complete in the schema but has zero UI.

Add to the Order Detail page:

- Courier name field
- Tracking ID field
- Estimated delivery date picker
- Status selector (`dispatched | in_transit | delivered | returned`)

When status is saved as `delivered`, the existing DB trigger automatically flips `orders.order_status → 'delivered'`. No extra code needed.

---

### 2.4 — Customer Detail Page

```
app/dashboard/customers/[id]/
  page.tsx              ← Full customer profile

Sections to include:
  Contact card            (name, phone, email, address, join date)
  Lifetime value strip    (total orders, total spent NGN, average order value)
  Order history table     (all orders, paginated, with status badges)
  WhatsApp chat link      (deep link opens conversation in WhatsApp)
  Notes field             (vendor-internal notes, saved to a text column on customers)
```

---

### 2.5 — Plan Upgrade Payment Flow

The billing page has plan cards with disabled "Upgrade" buttons. This prevents you from earning revenue from your own product. Use **Paystack Recurring Billing** (Subscriptions API).

**Steps:**

1. Create two plans in the Paystack dashboard (Growth ₦9,900/mo, Pro ₦24,900/mo)
2. Copy the Paystack `plan_code` for each
3. Add to DB:

```sql
-- supabase/migrations/003_subscription_fields.sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_customer_code  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_subscription_code  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status  text DEFAULT 'inactive';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at  timestamptz;
```

1. Build `POST /api/billing/subscribe` — calls Paystack `POST /subscription` API, stores codes
2. Build `POST /api/billing/webhook` — handles `subscription.create`, `subscription.disable`, `invoice.payment_failed` — updates `users.plan` and `subscription_status`
3. Enable the "Upgrade" buttons in the billing page

---

### 2.6 — Real-Time Order Updates

Orders placed by customers do not appear on the kanban without a page refresh. During a busy lunch rush, a restaurant could miss 5 orders because the vendor's screen is 10 minutes stale.

Supabase Realtime is already included in the SDK — it just needs to be wired into `KanbanBoard`:

```typescript
// Inside KanbanBoard.tsx, add:
import { createBrowserClient } from '@supabase/ssr';

useEffect(() => {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const channel = supabase
    .channel('orders-live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders', filter: `vendor_id=eq.${vendorId}` },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          // Add new order to the correct column
          setOrders(prev => [...prev, transformPayload(payload.new)]);
        }
        if (payload.eventType === 'UPDATE') {
          // Update existing order (status change, payment change)
          setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...transformPayload(payload.new) } : o));
        }
        if (payload.eventType === 'DELETE') {
          setOrders(prev => prev.filter(o => o.id !== payload.old.id));
        }
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [vendorId]);
```

**Estimated effort: 3–4 hours. Impact: Massive for live food/retail businesses.**

---

## Part 4 — Phase 3: CRM & Growth Engine (Weeks 4–6)

*What separates a dashboard from a real business operating system.*

### 3.1 — Customer Segmentation

Auto-classify customers by behavior so vendors can target the right people:

```
VIP        → 5+ orders OR total_spent > ₦50,000
Regular    → 2–4 orders
First-time → Only 1 order
At-Risk    → Last order was 30–60 days ago
Lapsed     → Last order was 60+ days ago
```

**DB (Postgres function — no schema change needed):**

```sql
CREATE OR REPLACE FUNCTION classify_customer(
  p_total_orders int,
  p_total_spent  numeric,
  p_last_order   timestamptz
) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_last_order < NOW() - INTERVAL '60 days'  THEN RETURN 'lapsed';     END IF;
  IF p_last_order < NOW() - INTERVAL '30 days'  THEN RETURN 'at_risk';    END IF;
  IF p_total_orders >= 5 OR p_total_spent >= 50000 THEN RETURN 'vip';     END IF;
  IF p_total_orders >= 2                        THEN RETURN 'regular';    END IF;
  RETURN 'first_time';
END;
$$;
```

**UI:** Add segment filter tabs above the customer table: All · VIP · Regular · First-time · At-Risk · Lapsed.

---

### 3.2 — WhatsApp Broadcast Campaigns (KILLER FEATURE)

This is the feature Nigerian vendors will pay ₦24,900/month for. The ability to blast their
entire customer base with a new menu, a promo, or a restock announcement — directly on WhatsApp.

**DB tables needed:**

```sql
CREATE TABLE broadcasts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             text NOT NULL,
  message          text NOT NULL,
  audience         jsonb NOT NULL,
  -- audience format: { "type": "all" | "segment" | "custom", "value": "vip" | ["phone1","phone2"] }
  status           text DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','sent','failed')),
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  recipient_count  int DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE broadcast_receipts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  phone        text NOT NULL,
  status       text DEFAULT 'queued'
    CHECK (status IN ('queued','sent','delivered','failed')),
  sent_at      timestamptz,
  error_msg    text
);
```

**Pages to build:**

```
app/dashboard/broadcasts/
  page.tsx          ← Campaign list: name, status, sent count, date sent
  new/page.tsx      ← Composer: message editor + audience selector + schedule picker
  [id]/page.tsx     ← Campaign detail: per-recipient delivery status

lib/actions/
  broadcasts.ts     ← createBroadcast, scheduleBroadcast, sendBroadcast Server Actions

app/api/broadcast/
  send/route.ts     ← Process queue in batches of 10 with 1-second delays (Meta rate limit)
```

**Rate limiting note:** Meta WhatsApp allows 1,000 messages/day on unverified accounts and progressively higher limits after Business Verification. The sending route must batch messages and throttle to avoid hitting limits. Use a queue approach with Supabase `broadcast_receipts` rows as the queue.

**Variable substitution in messages:**

```
"Hi {{customer_name}}! 🎉 Our new Pepper Soup is now available for ₦3,500. 
 Order now: {{store_link}}"
```

---

### 3.3 — WhatsApp Inbound Message Handling

Right now WhatsApp is one-way — you send notifications, you never hear back unless customers
call or text manually. To become a full Business OS, you must handle replies.

**Meta Webhook setup:**

1. Add URL in Meta Business dashboard: `POST /api/whatsapp/webhook`
2. Handle the `GET` challenge verification (Meta sends `hub.challenge` parameter)
3. Parse all `messages` events from the POST payload

**DB table:**

```sql
CREATE TABLE conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id),
  phone       text NOT NULL,
  direction   text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message     text NOT NULL,
  wa_msg_id   text,
  media_url   text,
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);
```

**Pages to build:**

```
app/dashboard/inbox/
  page.tsx          ← Conversation list (grouped by phone number, sorted by last message)
  [phone]/page.tsx  ← Single chat thread: full message history + reply input
```

**Sidebar link:** Add "Inbox" item with an unread count badge that increments in real-time.

---

### 3.4 — AI Chat Agent (BIGGEST DIFFERENTIATOR)

Deploy an AI assistant that automatically handles customer WhatsApp messages outside of
business hours or while the vendor is busy.

**Example interaction:**

```
Customer (2:30 AM): "How much is your Sunday rice?"
AI Agent: "Hi! Our Sunday Special Rice is ₦2,500 per portion, served with stew, 
           assorted meat + plantain. To order, visit: https://app.io/order/mama-kay
           Or reply ORDER and I'll walk you through it! 😊"
```

**How it works:**

1. Inbound message arrives at `/api/whatsapp/webhook`
2. Check if vendor has `ai_agent_enabled = true` AND is outside `business_hours`
3. Build a system prompt: "You are the AI assistant for [business name]. Products: [list]. Accept orders at: [link]."
4. Call OpenAI `gpt-4o-mini` with the customer's message
5. Send the AI response back via `sendTextMessage`
6. Log to `conversations` table

**DB additions:**

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_agent_enabled   boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_system_prompt   text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS business_hours     jsonb;
-- business_hours format: { "mon": { "open": "09:00", "close": "21:00" }, "tue": {...}, ... "sun": null }
```

**Cost estimate:** `gpt-4o-mini` costs ~$0.15/1M input tokens. A typical customer conversation
is ~500 tokens. 1,000 conversations/month = $0.075. Even at 10,000 conversations it's under
$1. This is a Pro plan exclusive feature — pure margin.

**AI Settings UI:**

```
app/dashboard/settings/
  ai/page.tsx       ← Toggle AI agent on/off + customise system prompt + set business hours
```

---

## Part 5 — Phase 4: Scaling & Intelligence (Weeks 7–10)

### 4.1 — Full Analytics Page

Replace the basic 4-card dashboard with a real analytics suite:

```
app/dashboard/analytics/
  page.tsx      ← Full analytics view

Charts to build (use Recharts — already common with Next.js):
  Revenue over time         (daily/weekly/monthly switcher, line chart)
  Order volume bar chart    (same time ranges)
  Order status funnel       (placed → confirmed → paid → delivered)
  Top 10 products           (by order count and by revenue — horizontal bars)
  Peak ordering hours       (heatmap: hour of day × day of week)
  Repeat purchase rate      (trending over time)
  Payment method split      (Paystack vs. manual/cash)
  Customer acquisition      (new customers per month)
  Average order value       (trending over time)
```

**Export:** Add CSV download for orders and customers list (date range filterable).

---

### 4.2 — Payment Links (Standalone)

Let vendors generate a Paystack payment link for any amount, without attaching it to a formal
order. Common use case: custom tailoring deposit, partial advance, re-order for trusted customer.

```
app/dashboard/payment-links/
  page.tsx          ← All links with status (pending/paid/expired)
  new/page.tsx      ← Create: amount, description, optional customer, expiry date

DB:
CREATE TABLE payment_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES users(id),
  reference   text NOT NULL UNIQUE,
  amount      numeric NOT NULL,
  description text,
  customer_id uuid REFERENCES customers(id),
  status      text DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  expires_at  timestamptz,
  paid_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);
```

---

### 4.3 — Invoice & Receipt Generation

After an order is paid, generate a PDF receipt that can be:

- Sent to the customer via WhatsApp message (as a document)
- Downloaded from the Order Detail page

**Tech:** Use `@react-pdf/renderer` — renders a React component as a PDF server-side.

```
app/api/invoice/[orderId]/
  route.ts      ← GET: generate PDF via @react-pdf/renderer, return as PDF stream

components/
  InvoiceTemplate.tsx   ← React component: vendor logo, order items table, subtotals, Paystack ref
```

Store generated PDFs in Supabase Storage (`invoices/[vendor_id]/[order_id].pdf`) so they're
not regenerated on every request.

---

### 4.4 — Multi-Staff Access

Restaurants and larger vendors need team accounts:

```sql
CREATE TABLE staff (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  role        text NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
  invited_by  uuid REFERENCES users(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(vendor_id, user_id)
);
```

**Roles:**

- `admin` — full access including billing
- `manager` — orders, customers, products, broadcasts
- `viewer` — read-only order view, no customer data

---

## Part 6 — Production Hardening (Ongoing)

### 5.1 — Error Monitoring (Do This Today)

Right now, every unhandled error in your app is silently swallowed or logged to `console.error`.
In production, you will never know when your webhook fails or a customer can't place an order.

```bash
cd whatsapp-order-saas
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Add to every API route:

```typescript
import * as Sentry from '@sentry/nextjs';
// In the catch block:
Sentry.captureException(err);
```

Free tier: 5,000 errors/month on Sentry.

---

### 5.2 — Rate Limiting on Public API Routes

`/api/paystack/initialize` is public (no auth). Any person who knows an `order_id` UUID (easily
guessable if sequential, though yours are random) can spam Paystack initialize calls against your
account. Add rate limiting with **Upstash Redis**:

```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// lib/rateLimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const apiRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 per minute per IP
  analytics: true,
});

// Usage in any route handler:
const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
const { success } = await apiRateLimit.limit(ip);
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
```

Protect: `/api/paystack/initialize`, `/order/[vendor]` submit action, `/api/whatsapp/webhook`.

---

### 5.3 — Transactional Email via Resend

Add email as a fallback channel when WhatsApp delivery fails, and for auth flows:

```bash
npm install resend
```

Email triggers to add:

- Welcome email on signup (with getting-started guide)
- Password reset emails (instead of relying solely on Supabase's default)
- Order confirmation (backup if WhatsApp fails)
- Payment receipt with invoice PDF attached
- Monthly usage report (orders used vs. plan limit)

Free tier: **3,000 emails/month on Resend**. More than enough to start.

---

### 5.4 — Route-Level Loading and Error States

Every dashboard route currently shows a blank white screen while fetching data. This looks broken.

For each dashboard route, add two files:

```
app/dashboard/loading.tsx          ← Skeleton screen: grey pulsing boxes
app/dashboard/error.tsx            ← Error boundary: "Something went wrong" with retry button
app/dashboard/orders/loading.tsx
app/dashboard/orders/error.tsx
app/dashboard/customers/loading.tsx
app/dashboard/customers/error.tsx
app/dashboard/analytics/loading.tsx
```

```typescript
// Example app/dashboard/orders/loading.tsx
export default function Loading() {
  return (
    <div className="p-6 space-y-4">
      {[1,2,3].map(i => (
        <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}
```

---

### 5.5 — Real Marketing Landing Page

`app/page.tsx` is currently a single dark card that says "OrderFlow" with two buttons.
No vendor will sign up based on this. You need a real marketing page.

**Sections:**

1. **Hero** — "Manage all your WhatsApp orders in one dashboard" + CTA to signup
2. **Problem** — "You're losing orders in WhatsApp chat chaos" — pain agitation
3. **How it works** — 3 steps: Share your link → Customer orders → You manage it
4. **Features grid** — Order tracking, Customer CRM, WhatsApp notifications, Analytics, Broadcasts, AI Agent
5. **Storefront demo** — Live embed or screenshot of the `/order/[vendor]` form
6. **Testimonials** — Social proof from Nigerian business owners (start with 2–3 beta users)
7. **Pricing** — Pull cards directly from the `PLANS` constant in `lib/plans.ts`
8. **FAQ** — "Can I use this without Paystack?", "How fast can customers order?", etc.
9. **Footer** — Social links, legal links, WhatsApp contact for support

---

### 5.6 — Legal Pages

Auth forms reference Terms of Service and Privacy Policy but those pages do not exist:

```
app/legal/
  terms/page.tsx      ← Terms of Service
  privacy/page.tsx    ← Privacy Policy
```

Do not skip this — Nigerian data protection law (NDPA 2023) requires a privacy policy
for apps that collect personal data (phone numbers, addresses). Non-compliance is a legal risk.

---

### 5.7 — Storefront SEO & WhatsApp Link Previews

When a vendor shares their storefront link on WhatsApp, it should show a preview card with their
business name and logo. The existing `generateMetadata` in `/order/[vendor]/page.tsx` is
partially implemented but missing OpenGraph image.

Extend it to:

```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // Fetch vendor as before...
  return {
    title: `Order from ${vendor.business_name}`,
    description: `Place your order with ${vendor.business_name} on WhatsApp`,
    openGraph: {
      title: vendor.business_name,
      description: `Quick ordering for ${vendor.business_name} customers`,
      images: vendor.logo_url ? [{ url: vendor.logo_url, width: 400, height: 400 }] : [],
      type: 'website',
      siteName: 'WhatsOrder',
    },
    twitter: {
      card: 'summary',
      title: vendor.business_name,
    },
  };
}
```

---

## Part 7 — New Database Migrations (Summary)

All migrations should be in `supabase/migrations/` as numbered SQL files:

```
supabase/migrations/
  003_settings_and_stats.sql      ← api_token, timezone; customer_stats view
  004_subscription_fields.sql     ← paystack codes, subscription_status, expires_at
  005_products_extended.sql       ← stock_count, category, sku
  006_broadcasts.sql              ← broadcasts + broadcast_receipts tables
  007_conversations.sql           ← conversations table with indexes
  008_payment_links.sql           ← payment_links table
  009_ai_agent.sql                ← ai_agent_enabled, ai_system_prompt, business_hours
  010_staff.sql                   ← staff table with roles
```

---

## Part 8 — External Services to Add

| Service | Purpose | Free Tier | When to Add |
|---|---|---|---|
| [Sentry](https://sentry.io) | Error monitoring + crash reports | 5,000 errors/mo | Immediately |
| [Upstash Redis](https://upstash.com) | Rate limiting on public routes | 10,000 req/day | Before launch |
| [Resend](https://resend.com) | Transactional email | 3,000 emails/mo | Week 2 |
| [OpenAI](https://platform.openai.com) | AI chat agent | Pay-per-use | Phase 4 |
| [Supabase Storage](https://supabase.com/storage) | Logos, invoice PDFs | Included in Supabase | Week 2 (for logos in settings) |

---

## Part 9 — The Week-by-Week Build Sequence

Build in this order to maximize value shipped per hour:

```
WEEK 1 — Kill the Bugs
  ✱ Delete /store/[slug] + add redirect in next.config.mjs
  ✱ Delete OrderBoard / OrderCard / OrderColumn
  ✱ Fix Settings page to load real DB data
  ✱ Add /forgot-password and /reset-password pages
  ✱ Fix NewOrderModal to insert order_items
  ✱ Add customer_stats DB view
  ✱ Add api_token column to schema

WEEK 2 — Products + Order Detail
  ✱ Product catalogue CRUD (list, add, edit, archive, image upload)
  ✱ Update storefront to show vendor's product cards
  ✱ Order detail page /dashboard/orders/[id]
  ✱ Delivery management on order detail page
  ✱ loading.tsx and error.tsx for all dashboard routes

WEEK 3 — Real-Time + CRM
  ✱ Supabase Realtime on KanbanBoard (3–4 hours, massive impact)
  ✱ Customer detail page with order history and LTV
  ✱ Customer segmentation tabs (VIP / Regular / First-time / At-Risk / Lapsed)
  ✱ Add Sentry error monitoring
  ✱ Add Resend transactional email (welcome + order confirmation)

WEEK 4 — Revenue + Analytics
  ✱ Paystack Subscriptions integration (billing actually works)
  ✱ Plan upgrade flow end-to-end
  ✱ Full analytics page with Recharts
  ✱ CSV export for orders and customers

WEEK 5 — Broadcasts + Inbox
  ✱ WhatsApp inbound webhook handler
  ✱ Conversations inbox with real-time updates
  ✱ Broadcast campaign builder (audience selector + message editor)
  ✱ Broadcast sender with rate-limited batch processing

WEEK 6 — AI + Payment Links
  ✱ AI agent setup (OpenAI integration + business hours config)
  ✱ AI Settings UI (toggle, prompt, hours)
  ✱ Standalone payment link generator
  ✱ Invoice PDF generation with @react-pdf/renderer

WEEK 7 — Launch Polish
  ✱ New marketing landing page (full 8-section)
  ✱ Legal pages (Terms + Privacy Policy per NDPA 2023)
  ✱ Rate limiting on all public API routes (Upstash)
  ✱ Storefront OpenGraph metadata
  ✱ SEO metadata on all dashboard pages
  ✱ PWA manifest for mobile "Add to Home Screen"
```

---

## Final Verdict

You have built a **technically sound, production-safe core**. The auth is correct, the
payments are properly secured with HMAC verification, the multi-tenant isolation is solid,
and the order flow works end-to-end. The architecture is good.

What you don't yet have is a **complete product**. Vendors who sign up today would encounter:
a settings page that overwrites their real data, no product catalogue, no way to view order
details, missing pages that return 404, and premium features that are UI stubs pointing
to nothing.

**The gap between where you are and a fully sellable ₦9,900–₦24,900/month SaaS is
approximately 6–7 weeks of focused implementation** following the roadmap above.

The bones are strong. Now it needs the flesh.

---

*Document compiled from a line-by-line audit of all 36 source files in the project.*
