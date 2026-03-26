import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import DashboardShell from "@/components/DashboardShell";
import { ensureVendorProfile } from "@/lib/vendorProfile";
import { resolvePlanId } from "@/lib/plans";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: vendorRow } = await supabase
    .from("users")
    .select("business_name, slug, phone, plan")
    .eq("id", user.id)
    .single();

  let vendor = vendorRow
    ? { ...vendorRow, plan: resolvePlanId(vendorRow.plan) }
    : null;

  if (!vendor) {
    const ensuredVendor = await ensureVendorProfile(user);
    vendor = { ...ensuredVendor, plan: resolvePlanId(undefined) };
  }

  return (
    <DashboardShell vendor={vendor} userEmail={user.email}>
      {children}
    </DashboardShell>
  );
}
