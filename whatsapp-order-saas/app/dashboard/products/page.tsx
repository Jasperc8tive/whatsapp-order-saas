import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("vendor_id", user.id)
    .order("created_at", { ascending: false });

  if (error && error.message.toLowerCase().includes("vendor_id")) {
    const retry = await supabase
      .from("products")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    products = retry.data;
    error = retry.error;
  }

  if (error && error.message.toLowerCase().includes("owner_id")) {
    const retry = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    products = retry.data;
    error = retry.error;
  }

  if (error) console.error("[ProductsPage] fetch error:", error);

  const normalizedProducts = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number((
      p.price ??
      p.unit_price ??
      (p as Record<string, unknown>).amount ??
      (p as Record<string, unknown>).product_price ??
      (p as Record<string, unknown>).selling_price ??
      (p as Record<string, unknown>).price_ngn ??
      0
    ) as number),
    is_active: Boolean((p.is_active ?? true) as boolean),
    created_at: (p.created_at as string) ?? new Date(0).toISOString(),
  }));

  return <ProductsClient initialProducts={normalizedProducts} />;
}
