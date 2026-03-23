import KanbanBoard from "@/components/KanbanBoard";
import NewOrderModal from "@/components/NewOrderModal";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import type { Order, OrderStatus } from "@/types/order";

// ── Fallback seed data shown when Supabase returns no rows ───────────────────
const SEED_ORDERS: Order[] = [
  {
    id: "a1b2c3d4-0001-0000-0000-000000000001",
    vendor_id: "vendor-1",
    customer_id: "cust-1",
    customer_name: "Amara Okonkwo",
    customer_phone: "+2348012345678",
    status: "pending",
    total_amount: 4500,
    items: [{ id: "i1", product_name: "Jollof Rice Pack", quantity: 2, unit_price: 2250 }],
    created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: "a1b2c3d4-0002-0000-0000-000000000002",
    vendor_id: "vendor-1",
    customer_id: "cust-2",
    customer_name: "Chidi Nwosu",
    customer_phone: "+2348098765432",
    status: "confirmed",
    total_amount: 2800,
    items: [{ id: "i2", product_name: "Shawarma Combo", quantity: 1, unit_price: 2800 }],
    created_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  },
  {
    id: "a1b2c3d4-0003-0000-0000-000000000003",
    vendor_id: "vendor-1",
    customer_id: "cust-3",
    customer_name: "Ngozi Eze",
    customer_phone: "+2348055544433",
    status: "processing",
    total_amount: 6200,
    items: [
      { id: "i3", product_name: "Grilled Chicken", quantity: 2, unit_price: 2600 },
      { id: "i4", product_name: "Pepsi 50cl",      quantity: 2, unit_price: 500  },
    ],
    created_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 60_000).toISOString(),
  },
  {
    id: "a1b2c3d4-0004-0000-0000-000000000004",
    vendor_id: "vendor-1",
    customer_id: "cust-4",
    customer_name: "Emeka Obi",
    customer_phone: "+2348033221100",
    status: "shipped",
    total_amount: 3500,
    items: [{ id: "i5", product_name: "Fried Rice + Chicken", quantity: 1, unit_price: 3500 }],
    created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 45 * 60_000).toISOString(),
  },
  {
    id: "a1b2c3d4-0005-0000-0000-000000000005",
    vendor_id: "vendor-1",
    customer_id: "cust-5",
    customer_name: "Fatima Bello",
    customer_phone: "+2348077665544",
    status: "delivered",
    total_amount: 5100,
    items: [{ id: "i6", product_name: "Egusi Soup + Pounded Yam", quantity: 3, unit_price: 1700 }],
    created_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 3_600_000).toISOString(),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function OrdersPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orders: Order[] = [];

  if (user) {
    const { data: orderRows, error } = await supabase
      .from("orders")
      .select("*")
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && orderRows) {
      const customerIds = Array.from(
        new Set(
          orderRows
            .map((row) => (row.customer_id as string | null) ?? null)
            .filter((id): id is string => Boolean(id))
        )
      );

      const { data: customers } = customerIds.length
        ? await supabase
            .from("customers")
            .select("id, name, phone")
            .in("id", customerIds)
        : { data: [] as Array<{ id: string; name: string; phone: string }> };

      const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

      const orderIds = orderRows.map((row) => row.id as string);
      const { data: itemRows } = orderIds.length
        ? await supabase
            .from("order_items")
            .select("id, order_id, product_name, quantity, price")
            .in("order_id", orderIds)
        : { data: [] as Array<{ id: string; order_id: string; product_name: string; quantity: number; price: number }> };

      const itemsByOrderId = new Map<string, Array<{ id: string; product_name: string; quantity: number; price: number }>>();
      for (const item of itemRows ?? []) {
        const list = itemsByOrderId.get(item.order_id) ?? [];
        list.push({
          id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          price: Number((item.price ?? (item as Record<string, unknown>).unit_price ?? 0) as number),
        });
        itemsByOrderId.set(item.order_id, list);
      }

      orders = orderRows.map((row) => {
        const customerId = (row.customer_id as string | null) ?? "";
        const customer = customerById.get(customerId);
        const items = itemsByOrderId.get(row.id as string) ?? [];

        return {
          id: row.id,
          vendor_id: user.id,
          customer_id: customerId,
          customer_name: customer?.name ?? "Unknown Customer",
          customer_phone: customer?.phone ?? "",
          status: ((row.order_status ?? row.status) as OrderStatus) ?? "pending",
          total_amount: Number((row.total_amount ?? row.total ?? 0) as number),
          items: items.map((item) => ({
            id: item.id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.price,
          })),
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
        } satisfies Order;
      });
    }
  } else {
    // Fallback seed is only for unauthenticated local/demo rendering.
    orders = SEED_ORDERS;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Order Board</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Drag cards between columns to update order status
          </p>
        </div>
        <NewOrderModal vendorId={user?.id ?? ""} />
      </div>

      <KanbanBoard initialOrders={orders} vendorId={user?.id ?? ""} />
    </div>
  );
}
