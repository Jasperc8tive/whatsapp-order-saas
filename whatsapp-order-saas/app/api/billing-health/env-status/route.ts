import { NextResponse } from "next/server";

export async function GET() {
  // Simulate env var check (replace with real required vars)
  const requiredVars = ["OPENAI_API_KEY", "PAYSTACK_SECRET_KEY", "PAYSTACK_WEBHOOK_URL"];
  const missing = requiredVars.filter((v) => !process.env[v]);
  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    message: missing.length === 0 ? "All required environment variables are set." : `Missing: ${missing.join(", ")}`
  });
}
