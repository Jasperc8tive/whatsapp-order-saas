import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabaseAdmin";

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function ensureVendorProfile(user: User) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("users")
    .select("id, business_name, slug, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const businessName =
    (user.user_metadata?.business_name as string | undefined)?.trim() ||
    user.email?.split("@")[0]?.replace(/[._-]+/g, " ") ||
    "My Store";
  const phone = (user.user_metadata?.phone as string | undefined)?.trim() || null;
  const email = user.email;

  if (!email) {
    throw new Error("Authenticated user is missing an email address.");
  }

  const slugBase = slugify(businessName) || "store";
  const slug = `${slugBase}-${user.id.slice(0, 6)}`;

  const { data, error } = await admin
    .from("users")
    .insert({
      id: user.id,
      business_name: businessName,
      email,
      phone,
      slug,
    })
    .select("id, business_name, slug, phone")
    .single();

  if (error) {
    throw error;
  }

  return data;
}