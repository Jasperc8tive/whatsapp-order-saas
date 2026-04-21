import { NextRequest, NextResponse } from "next/server";
import { generateSmartReplySuggestions } from "@/lib/actions/orders";

export async function POST(req: NextRequest) {
  try {
    const { orderId, customerMessage } = await req.json();
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    const { data, error } = await generateSmartReplySuggestions(orderId, customerMessage);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ suggestions: data?.suggestions ?? [], confidence: data?.confidence ?? null });
  } catch (e) {
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
