import { createClient } from "@supabase/supabase-js";
import { requireEnvValue } from "@/lib/env";

/**
 * Service-role Supabase client — bypasses RLS.
 * ONLY use in trusted server-side code (server actions, Route Handlers).
 * NEVER import this in client components or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createAdminClient() {
  const url = requireEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL"
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = requireEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
  const key = serviceRoleKey || anonKey;

  if (!serviceRoleKey) {
    console.warn(
      "[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to anon key. Some admin-only operations may be limited."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
