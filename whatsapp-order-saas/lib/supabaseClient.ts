import { createBrowserClient } from "@supabase/ssr";
import { requireEnvValue } from "@/lib/env";

const supabaseUrl = requireEnvValue(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL"
);
const supabaseKey = requireEnvValue(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
);

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);
