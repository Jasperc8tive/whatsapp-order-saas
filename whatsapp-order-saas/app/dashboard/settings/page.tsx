import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
	const supabase = await createServerSupabaseClient();
	const headerList = await headers();
	const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
	const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
	const siteOrigin = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) redirect("/login");

	const { data: vendor, error } = await supabase
		.from("users")
		.select("business_name, slug, phone")
		.eq("id", user.id)
		.single();

	if (error || !vendor) {
		console.error("[SettingsPage] vendor fetch error:", error);
	}

	return (
		<SettingsForm
			businessName={vendor?.business_name ?? ""}
			slug={vendor?.slug ?? ""}
			siteOrigin={siteOrigin}
			whatsappNumber={vendor?.phone ?? null}
		/>
	);
}
