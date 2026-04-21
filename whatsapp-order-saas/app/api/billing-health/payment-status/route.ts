import { NextResponse } from "next/server";

export async function GET() {
  // Simulate payment provider status check (replace with real API call)
  const paystackStatus = {
    ok: true,
    provider: "Paystack",
    message: "API reachable and configured."
  };
  // Add more providers as needed
  return NextResponse.json({ providers: [paystackStatus] });
}
