export const ENV = {
  SUPABASE_URL:
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "",
  API_BASE_URL:
    process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "https://whatsorder.app",
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN ?? "",
};

export function assertMobileEnv(): void {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }
}
