"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export interface SettingsState {
  error?: string;
  success?: boolean;
}

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const business_name    = (formData.get("business_name")    as string)?.trim();
  const slug             = (formData.get("slug")             as string)?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const phone            = (formData.get("phone")            as string)?.trim() || null;

  if (!business_name) return { error: "Store name is required." };
  if (!slug)          return { error: "Slug is required." };

  const { error } = await admin
    .from("users")
    .upsert(
      {
        id: user.id,
        email: user.email,
        business_name,
        slug,
        phone,
      },
      { onConflict: "id" }
    );

  if (error) {
    if (error.code === "23505") return { error: "That slug is already taken. Please choose another." };
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
