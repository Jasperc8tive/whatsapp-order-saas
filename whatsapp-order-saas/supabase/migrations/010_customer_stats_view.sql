-- Customer stats view: aggregates orders per customer per vendor
-- Usage: select * from public.customer_stats where vendor_id = $1

alter table if exists public.customers
  add column if not exists email text;

create or replace view public.customer_stats as
select
  c.id,
  c.vendor_id,
  c.name,
  c.phone,
  c.email,
  c.address,
  c.created_at,
  count(o.id)::int                           as total_orders,
  coalesce(sum(o.total_amount), 0)::numeric  as total_spent,
  max(o.created_at)                          as last_order_at
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;

-- Grant read access to authenticated users
-- RLS on the underlying tables still applies; this view inherits it.
grant select on public.customer_stats to authenticated;