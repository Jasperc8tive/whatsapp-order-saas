import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  // getUser() validates the JWT server-side — never trust getSession() alone
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // Fetch the vendor's profile from the public.users table
  const { data: vendor } = await supabase
    .from("users")
    .select("business_name, plan, slug, whatsapp_number")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar vendor={vendor} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar title="Dashboard" vendorName={vendor?.business_name} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
