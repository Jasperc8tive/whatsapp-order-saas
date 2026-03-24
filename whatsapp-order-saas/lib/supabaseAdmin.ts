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
  const key = requireEnvValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY"
  );

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
