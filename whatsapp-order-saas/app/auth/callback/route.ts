import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { ensureVendorProfile } from "@/lib/vendorProfile";

/**
 * Handles the email-confirmation redirect from Supabase.
 * Supabase appends ?code=<pkce_code> to the URL specified in emailRedirectTo.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code    = searchParams.get("code");
  const next    = searchParams.get("next") ?? "/dashboard";
  const errorParam = searchParams.get("error_description");
  const isWorkspaceInviteRedirect = next.startsWith("/team/accept");

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorParam)}`
    );
  }

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        if (!isWorkspaceInviteRedirect) {
          await ensureVendorProfile(user);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Could not verify your email. Try signing in.")}`
  );
}
