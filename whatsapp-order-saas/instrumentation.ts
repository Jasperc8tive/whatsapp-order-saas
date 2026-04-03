import * as Sentry from "@sentry/nextjs";

const REQUIRED_SERVER_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * Validate that all required environment variables are present at startup.
 * Logs warnings for missing vars rather than crashing, so the app can still
 * partially start and surface a proper error message in the affected routes.
 */
function validateEnvVars(): void {
  const missing: string[] = [];
  for (const name of REQUIRED_SERVER_ENV_VARS) {
    if (!process.env[name]) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    console.error(
      `[instrumentation] Missing required environment variables: ${missing.join(", ")}. ` +
      `The application may not function correctly. Please set them in your .env.local or deployment config.`
    );
  }
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    validateEnvVars();
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
