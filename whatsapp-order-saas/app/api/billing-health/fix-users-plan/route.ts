import { createAdminClient } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function POST() {
  const admin = createAdminClient();
  // Set missing/invalid users.plan to 'starter'
  const { error } = await admin
    .from("users")
    .update({ plan: "starter" })
    .or("plan.is.null,plan.eq.'',plan.not.in.(starter,growth,pro)");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
