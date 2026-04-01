import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { getCurrentWorkspaceRole } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const role = await getCurrentWorkspaceRole(user.id);
  if (role !== "owner") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  // Set missing/invalid users.plan to 'starter'
  const { error } = await admin
    .from("users")
    .update({ plan: "starter" })
    .or("plan.is.null,plan.eq.'',plan.not.in.(starter,growth,pro)");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
