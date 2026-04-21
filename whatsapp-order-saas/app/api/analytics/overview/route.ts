import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentWorkspaceId } from "@/lib/workspace";

function resolveDateRange(range: string | null): { from: string; to: string; range: string } {
  const now = new Date();
  const to = now.toISOString();

  const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
  const fromDate = new Date(now);
  fromDate.setDate(now.getDate() - days + 1);

  return {
    from: fromDate.toISOString(),
    to,
    range: `${days}d`,
  };
}

function escapeCsvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function toOverviewCsv(payload: {
  range: string;
  from: string;
  to: string;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
  topCustomers: Array<{
    name: string;
    totalOrders: number;
    totalSpent: number;
  }>;
  topProducts: Array<{
    productName: string;
    unitsSold: number;
    revenue: number;
  }>;
  ordersPerDay: Array<{
    date: string;
    orders: number;
    revenue: number;
  }>;
}) {
  const rows: string[] = ["section,label,value,extra"];

  rows.push(["summary", "range", payload.range, ""].map(escapeCsvCell).join(","));
  rows.push(["summary", "from", payload.from, ""].map(escapeCsvCell).join(","));
  rows.push(["summary", "to", payload.to, ""].map(escapeCsvCell).join(","));
  rows.push(["summary", "total_orders", payload.summary.totalOrders, ""].map(escapeCsvCell).join(","));
  rows.push(["summary", "total_revenue", payload.summary.totalRevenue, ""].map(escapeCsvCell).join(","));
  rows.push(["summary", "average_order_value", payload.summary.averageOrderValue, ""].map(escapeCsvCell).join(","));

  for (const day of payload.ordersPerDay) {
    rows.push(["orders_per_day", day.date, day.orders, day.revenue].map(escapeCsvCell).join(","));
  }

  for (const customer of payload.topCustomers) {
    rows.push(["top_customer", customer.name, customer.totalOrders, customer.totalSpent].map(escapeCsvCell).join(","));
  }

  for (const product of payload.topProducts) {
    rows.push(["top_product", product.productName, product.unitsSold, product.revenue].map(escapeCsvCell).join(","));
  }

  return rows.join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice("Bearer ".length);
    const admin = createAdminClient();
    const { data: authResult, error: authError } = await admin.auth.getUser(token);

    if (authError || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await getCurrentWorkspaceId(authResult.user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const rangeParam = request.nextUrl.searchParams.get("range");
    const { from, to, range } = resolveDateRange(rangeParam);

    const { data: orders, error: orderError } = await admin
      .from("orders")
      .select("id, customer_id, total_amount, created_at")
      .eq("vendor_id", workspaceId)
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true });

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    const orderRows = orders ?? [];
    const orderIds = orderRows.map((row) => row.id as string);
    const customerIds = Array.from(new Set(orderRows.map((row) => row.customer_id).filter(Boolean) as string[]));

    const [itemsRes, customersRes] = await Promise.all([
      orderIds.length
        ? admin
            .from("order_items")
            .select("order_id, product_name, quantity, price")
            .in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null } as const),
      customerIds.length
        ? admin
            .from("customers")
            .select("id, name, phone")
            .in("id", customerIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    if (itemsRes.error) {
      return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
    }

    if (customersRes.error) {
      return NextResponse.json({ error: customersRes.error.message }, { status: 500 });
    }

    const customerNameById = new Map<string, { name: string; phone: string }>(
      (customersRes.data ?? []).map((row) => [row.id as string, { name: (row.name as string) ?? "Unknown", phone: (row.phone as string) ?? "" }])
    );

    const topCustomerMap = new Map<string, { customerId: string; name: string; phone: string; totalOrders: number; totalSpent: number }>();
    const ordersPerDayMap = new Map<string, { date: string; orders: number; revenue: number }>();

    for (const order of orderRows) {
      const customerId = (order.customer_id as string | null) ?? "unknown";
      const customerMeta = customerNameById.get(customerId) ?? { name: "Unknown", phone: "" };
      const amount = Number(order.total_amount ?? 0);

      if (!topCustomerMap.has(customerId)) {
        topCustomerMap.set(customerId, {
          customerId,
          name: customerMeta.name,
          phone: customerMeta.phone,
          totalOrders: 0,
          totalSpent: 0,
        });
      }

      const customerAgg = topCustomerMap.get(customerId)!;
      customerAgg.totalOrders += 1;
      customerAgg.totalSpent += amount;

      const day = new Date(order.created_at as string).toISOString().slice(0, 10);
      if (!ordersPerDayMap.has(day)) {
        ordersPerDayMap.set(day, { date: day, orders: 0, revenue: 0 });
      }
      const dayAgg = ordersPerDayMap.get(day)!;
      dayAgg.orders += 1;
      dayAgg.revenue += amount;
    }

    const topProductMap = new Map<string, { productName: string; unitsSold: number; revenue: number }>();
    for (const item of itemsRes.data ?? []) {
      const productName = (item.product_name as string) ?? "Unknown product";
      const quantity = Number(item.quantity ?? 0);
      const price = Number(item.price ?? 0);

      if (!topProductMap.has(productName)) {
        topProductMap.set(productName, { productName, unitsSold: 0, revenue: 0 });
      }
      const productAgg = topProductMap.get(productName)!;
      productAgg.unitsSold += quantity;
      productAgg.revenue += quantity * price;
    }

    const totalRevenue = orderRows.reduce((sum, row) => sum + Number(row.total_amount ?? 0), 0);

    const responsePayload = {
      range,
      from,
      to,
      summary: {
        totalOrders: orderRows.length,
        totalRevenue,
        averageOrderValue: orderRows.length ? totalRevenue / orderRows.length : 0,
      },
      topCustomers: Array.from(topCustomerMap.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 10),
      topProducts: Array.from(topProductMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
      ordersPerDay: Array.from(ordersPerDayMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };

    if (request.nextUrl.searchParams.get("format") === "csv") {
      const csv = toOverviewCsv(responsePayload);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=analytics_overview_${range}.csv`,
        },
      });
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("[analytics/overview]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
