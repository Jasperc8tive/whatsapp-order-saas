import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import OrderForm from "@/components/storefront/OrderForm";
import { DEMO_PRODUCTS, DEMO_VENDOR, DEMO_VENDOR_SLUG } from "@/lib/demoStore";

interface Props {
  params: { vendor: string };
}

// ── Dynamic metadata ─────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (params.vendor === DEMO_VENDOR_SLUG) {
    return {
      title: `Order from ${DEMO_VENDOR.business_name} — OrderFlow`,
    };
  }

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("users")
    .select("business_name")
    .eq("slug", params.vendor)
    .single();

  return {
    title: data?.business_name
      ? `Order from ${data.business_name} — OrderFlow`
      : "Place an order — OrderFlow",
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function VendorOrderPage({ params }: Props) {
  const supabase = await createServerSupabaseClient();

  let vendor: {
    id: string;
    business_name: string;
    slug: string;
    phone: string | null;
  } | null = null;

  let products: Array<{
    id: string;
    name: string;
    description?: string | null;
    price: number;
    image_url?: string | null;
  }> = [];

  if (params.vendor === DEMO_VENDOR_SLUG) {
    vendor = DEMO_VENDOR;
    products = DEMO_PRODUCTS;
  } else {
    const { data: dbVendor } = await supabase
      .from("users")
      .select("id, business_name, slug, phone")
      .eq("slug", params.vendor)
      .single();

    vendor = dbVendor;

    if (vendor) {
      let { data: dbProducts, error: dbProductsError } = await supabase
        .from("products")
        .select("*")
        .eq("vendor_id", vendor.id)
        .eq("is_active", true)
        .order("name");

      if (dbProductsError && dbProductsError.message.toLowerCase().includes("vendor_id")) {
        const retry = await supabase
          .from("products")
          .select("*")
          .eq("owner_id", vendor.id)
          .eq("is_active", true)
          .order("name");
        dbProducts = retry.data;
        dbProductsError = retry.error;
      }

      if (dbProductsError) {
        console.error("[VendorOrderPage] products fetch error:", dbProductsError);
      }

      products = (dbProducts ?? []).map((p) => ({
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
      }));
    }
  }

  if (!vendor) notFound();

  const initials = vendor.business_name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-gray-50 flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-lg">

        {/* Vendor header card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-4 text-center">
          {params.vendor === DEMO_VENDOR_SLUG && (
            <div className="mb-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Demo Store
              </div>
              <p className="text-[11px] text-amber-700/80 mt-1.5">
                Orders here are simulated and are not saved to a real vendor account.
              </p>
            </div>
          )}

          <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-xl font-bold text-white">{initials}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{vendor.business_name}</h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Orders fulfilled via WhatsApp
          </p>
        </div>

        {/* Order form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-5">Place your order</h2>
          <OrderForm
            vendorSlug={vendor.slug}
            vendorName={vendor.business_name}
            vendorPhone={vendor.phone}
            products={products}
          />
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Powered by <span className="font-semibold text-gray-500">OrderFlow</span>
        </p>
      </div>
    </div>
  );
}
