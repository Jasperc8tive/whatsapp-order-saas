import { checkBillingSchemaHealth } from "@/lib/billingHealth";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await checkBillingSchemaHealth();
  return NextResponse.json(result);
}
