import { NextResponse } from "next/server";

export async function GET() {
  // Simulate webhook delivery check (replace with real logic)
  const webhookStatus = {
    ok: true,
    url: process.env.PAYSTACK_WEBHOOK_URL || "not set",
    message: process.env.PAYSTACK_WEBHOOK_URL ? "Webhook URL is set." : "Webhook URL missing!"
  };
  return NextResponse.json({ webhook: webhookStatus });
}
