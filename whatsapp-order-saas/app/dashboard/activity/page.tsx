import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import ActivityTimeline from "@/components/ActivityTimeline";

export const metadata = { title: "Activity Log" };

export default async function ActivityPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get vendor/workspace
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name")
    .eq("user_id", user.id)
    .single();

  if (!vendor) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <ActivityTimeline vendorId={vendor.id} autoRefresh={true} />
      </div>
    </div>
  );
}
