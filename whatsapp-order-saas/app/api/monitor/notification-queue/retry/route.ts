import { createAdminClient } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
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
