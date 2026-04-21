import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnvValue } from "@/lib/env";

export async function createServerSupabaseClient() {
  const supabaseUrl = requireEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    "NEXT_PUBLIC_SUPABASE_URL"
  );
  const supabaseKey = requireEnvValue(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch (err) {
          console.warn("[supabaseServer] Failed to set cookie:", err instanceof Error ? err.message : String(err));
        }
      },
    },
  });
}
