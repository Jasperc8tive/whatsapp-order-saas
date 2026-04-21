// Billing health check utility
// Checks for billing schema readiness and missing users.plan

import { createAdminClient } from "@/lib/supabaseAdmin";

export async function checkBillingSchemaHealth() {
  const admin = createAdminClient();
  // Check if users.plan column exists and is valid
  const { data, error } = await admin.rpc("introspect_column_exists", {
    table_name: "users",
    column_name: "plan"
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "users.plan column missing" };
  // Check for users with missing/invalid plan
  const { data: missing, error: missingError } = await admin
    .from("users")
    .select("id, email")
    .or("plan.is.null,plan.eq.'',plan.not.in.(starter,growth,pro)");
  if (missingError) return { ok: false, error: missingError.message };
  if (missing && missing.length > 0) {
    return {
      ok: false,
      error: "Some users have missing or invalid plan",
      users: missing
    };
  }
  return { ok: true };
}
