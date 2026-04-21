import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import CustomersClient from "./CustomersClient";

// Matches the columns that exist in the Supabase customers table
interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  created_at: string;
}

export default async function CustomersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, phone, created_at")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[CustomersPage] fetch error:", error);
  }

  const rows: CustomerRow[] = customers ?? [];

  // --- Bulk selection state (client only) ---
  // This is a scaffold: actual state/logic should be in a client component
  // For now, just show the import button in the header

  return (
    <CustomersClient customers={rows} vendorId={user.id} />
  );
}

