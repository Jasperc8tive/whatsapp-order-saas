import KanbanBoard from "@/components/KanbanBoard";
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

  let orders: Order[] = SEED_ORDERS;

  if (user) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `id,
         order_status,
         total_amount,
         created_at,
         updated_at,
         customer_id,
         customers ( name, phone ),
         order_items ( id, product_name, quantity, price )`
      )
      .eq("vendor_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      orders = data.map((row) => {
        const customer = (row.customers as unknown) as { name: string; phone: string } | null;
        const items = (
          (row.order_items as unknown) as Array<{ id: string; product_name: string; quantity: number; price: number }>
        ) ?? [];

        return {
          id: row.id,
          vendor_id: user.id,
          customer_id: (row.customer_id as string | null) ?? "",
          customer_name: customer?.name ?? "Unknown Customer",
          customer_phone: customer?.phone ?? "",
          status: row.order_status as OrderStatus,
          total_amount: Number(row.total_amount),
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
        <button className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + New Order
        </button>
      </div>

      <KanbanBoard initialOrders={orders} />
    </div>
  );
}
