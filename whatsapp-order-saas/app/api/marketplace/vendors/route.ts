import { NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabaseAdmin";

function parseLimit(raw: string | null): number {
  const value = Number(raw ?? 30);
  if (!Number.isFinite(value)) return 30;
  return Math.min(100, Math.max(1, Math.floor(value)));
}

export async function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    const admin = createAdminClient();
    let query = admin
      .from("users")
      .select("id,business_name,slug,whatsapp_number,created_at")
      .not("slug", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (q) {
      query = query.or(`business_name.ilike.%${q}%,slug.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const vendors = (data ?? [])
      .filter((row) => Boolean(row.slug))
      .map((row) => ({
        id: row.id,
        businessName: row.business_name,
        slug: row.slug,
        whatsappNumber: row.whatsapp_number,
      }));

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error("[marketplace/vendors]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
