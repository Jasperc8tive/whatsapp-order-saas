import { createAdminClient } from "@/lib/supabaseAdmin";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { getCurrentWorkspaceRole } from "@/lib/workspace";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getCurrentWorkspaceRole(user.id);
  if (role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const admin = createAdminClient();
  // Reset status and run_at for retry
  await admin
    .from("job_queue")
    .update({ status: "queued", run_at: new Date().toISOString(), last_error: null })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
