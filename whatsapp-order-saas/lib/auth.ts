"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { ensureVendorProfile } from "@/lib/vendorProfile";

export type AuthState = {
  error?: string;
  message?: string;
} | null;

// ── Sign In ──────────────────────────────────────────────────────────────────
export async function signIn(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createServerSupabaseClient();

  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ── Sign Up ──────────────────────────────────────────────────────────────────
export async function signUp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createServerSupabaseClient();

  const business_name = (formData.get("business_name") as string)?.trim();
  const email         = (formData.get("email")         as string)?.trim();
  const phone         = (formData.get("phone")         as string)?.trim() || null;
  const password      =  formData.get("password")      as string;

  if (!business_name || !email || !password) {
    return { error: "Business name, email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  // Build a URL-safe slug from the business name
  const baseSlug = business_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { business_name, phone },    // stored in auth.users.raw_user_meta_data
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/callback`,
    },
  });

  if (authError) return { error: authError.message };

  // Insert the vendor profile row.
  // If email confirmation is enabled, data.user exists but data.session is null.
  // We still create the profile now so the callback redirect lands correctly.
  if (data.user) {
    try {
      await ensureVendorProfile({
        ...data.user,
        email,
        user_metadata: { ...data.user.user_metadata, business_name, phone, slug },
      });
    } catch (profileError) {
      return { error: profileError instanceof Error ? profileError.message : "Could not create vendor profile." };
    }
  }

  // Email confirmation required → tell the user to check their inbox
  if (!data.session) {
    return {
      message:
        "Account created! Check your email to confirm your address, then log in.",
    };
  }

  // No confirmation required → go straight to dashboard
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

// ── Sign Out ─────────────────────────────────────────────────────────────────
export async function signOut(): Promise<never> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ── Reset Password (send email) ──────────────────────────────────────────────
export async function resetPassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createServerSupabaseClient();
  const email = (formData.get("email") as string)?.trim();

  if (!email) return { error: "Email is required." };

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/reset-password`,
  });

  if (error) return { error: error.message };

  return { message: "Check your email for a password reset link." };
}

// ── Update Password (after clicking reset link) ──────────────────────────────
export async function updatePassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createServerSupabaseClient();
  const password        = formData.get("password")        as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
