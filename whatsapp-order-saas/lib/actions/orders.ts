"use server";

import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import type { OrderStatus } from "@/types/order";
import { notifyOrderShipped } from "@/lib/whatsapp";

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Unauthenticated" };

  const { error } = await supabase
    .from("orders")
    .update({
      order_status: newStatus,
      updated_at: new Date().toISOString(),
    })
    // Scope update to this vendor's orders only (defence in depth on top of RLS)
    .eq("id", orderId)
    .eq("vendor_id", user.id);

  if (error) return { error: error.message };

  // ── WhatsApp notification on "shipped" ───────────────────────────────────
  if (newStatus === "shipped") {
    // Use admin client to fetch related data outside the vendor's RLS session
    const admin = createAdminClient();

    const { data: orderRow } = await admin
      .from("orders")
      .select(
        `id,
         customers ( name, phone ),
         deliveries ( courier, tracking_id, delivery_status )`
      )
      .eq("id", orderId)
      .single();

    const customer  = (orderRow?.customers as unknown) as { name: string; phone: string } | null;
    // deliveries is one-to-many; take the most recent active delivery
    const deliveries = (orderRow?.deliveries as unknown) as Array<{
      courier: string | null;
      tracking_id: string | null;
      delivery_status: string;
    }> | null;
    const delivery = deliveries?.find((d) => d.delivery_status !== "returned") ?? deliveries?.[0];

    // Fetch vendor business_name for the message
    const { data: vendorRow } = await admin
      .from("users")
      .select("business_name")
      .eq("id", user.id)
      .single();

    if (customer?.phone) {
      notifyOrderShipped({
        customerName: customer.name,
        customerPhone: customer.phone,
        orderId,
        orderRef: orderId.slice(0, 8).toUpperCase(),
        vendorName: vendorRow?.business_name ?? "the vendor",
        courier: delivery?.courier ?? null,
        trackingId: delivery?.tracking_id ?? null,
      });
    }
  }

  return {};
}
