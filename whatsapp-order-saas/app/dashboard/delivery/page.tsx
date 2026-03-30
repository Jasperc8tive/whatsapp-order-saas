import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import OrderAssignmentBoard from "@/components/OrderAssignmentBoard";

export const metadata = { title: "Delivery Queue" };

export default async function DeliveryQueuePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Get vendor/workspace - check if user is owner
  const { data: vendor } = await supabase
    .from("users")
    .select("id, business_name")
    .eq("id", user.id)
    .single();

  if (!vendor) redirect("/login");

  // Get unassigned and assigned orders for this vendor
  const { data: ordersData } = await admin
    .from("orders")
    .select(
      `
      id,
      customer_id,
      customers(name, phone),
      total_amount,
      order_status,
      created_at
    `
    )
    .eq("vendor_id", vendor.id)
    .in("order_status", ["pending", "confirmed", "processing"])
    .order("created_at", { ascending: false });

  // Get delivery managers/staff for this workspace
  const { data: deliveryManagersData } = await admin
    .from("workspace_members")
    .select("id, user_id, role, display_name")
    .eq("workspace_id", vendor.id)
    .eq("is_active", true)
    .in("role", ["staff", "delivery_manager"]);

  const orders = ordersData ?? [];
  const deliveryManagers = deliveryManagersData ?? [];

  // Get order assignments
  const orderIds = orders.map((order) => order.id);

  // Only fetch assignments for visible orders to avoid cross-workspace reads
  const { data: assignmentsData } = orderIds.length
    ? await admin
        .from("order_assignments")
        .select("order_id, assigned_to, assigned_by")
        .in("order_id", orderIds)
    : { data: [] as Array<{ order_id: string; assigned_to: string; assigned_by: string }> };

  const assignments = assignmentsData ?? [];

  // Create assignment map for quick lookup
  const assignmentMap = new Map(assignments.map((a) => [a.order_id, a]));

  // Get user details for assigned managers
  const userCache = new Map<string, {
    user_metadata?: { display_name?: string; name?: string };
    email?: string;
  }>();

  await Promise.all(
    deliveryManagers.map(async (manager) => {
      if (userCache.has(manager.user_id)) return;

      try {
        const { data } = await admin.auth.admin.getUserById(manager.user_id);
        if (data?.user) {
          userCache.set(manager.user_id, {
            user_metadata: data.user.user_metadata as {
              display_name?: string;
              name?: string;
            },
            email: data.user.email ?? undefined,
          });
        }
      } catch {
        // Continue
      }
    })
  );

  // Format orders with assignment data
  const formattedOrders = orders.map((order: any) => {
    const assignment = assignmentMap.get(order.id);
    return {
      id: order.id,
      customer_id: order.customer_id,
      customer_name: order.customers?.name || "Unknown",
      customer_phone: order.customers?.phone || "",
      total_amount: order.total_amount,
      order_status: order.order_status,
      created_at: order.created_at,
      assignment: assignment
        ? {
            assigned_to: assignment.assigned_to,
            assigned_by: assignment.assigned_by,
          }
        : undefined,
    };
  });

  // Format delivery managers
  const formattedManagers = deliveryManagers.map((manager: any) => {
    const userData = userCache.get(manager.user_id);
    return {
      id: manager.id,
      user_id: manager.user_id,
      display_name:
        manager.display_name ||
        userData?.user_metadata?.display_name ||
        userData?.user_metadata?.name ||
        userData?.email ||
        "Team Member",
      email: userData?.email || "",
      role: manager.role,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <OrderAssignmentBoard
          orders={formattedOrders}
          deliveryManagers={formattedManagers}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
