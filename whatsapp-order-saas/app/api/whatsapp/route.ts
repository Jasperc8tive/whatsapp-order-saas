import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

import { parseOrderFromMessage, type CatalogItem } from "@/lib/ai-parse";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentWorkspaceId } from "@/lib/workspace";

type Action = "parse_message" | "parse_voice" | "smart_reply";

interface ParseMessageBody {
  action: "parse_message";
  message: string;
  customerPhone?: string;
}

interface ParseVoiceBody {
  action: "parse_voice";
  audioBase64: string;
  mimeType?: string;
  customerPhone?: string;
}

interface SmartReplyBody {
  action: "smart_reply";
  context: string;
}

type RequestBody = ParseMessageBody | ParseVoiceBody | SmartReplyBody;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }
  return new OpenAI({ apiKey });
}

async function buildCatalog(admin: ReturnType<typeof createAdminClient>, workspaceId: string): Promise<CatalogItem[]> {
  const [{ data: products }, { data: aliases }] = await Promise.all([
    admin
      .from("products")
      .select("id,name,price,is_active")
      .eq("vendor_id", workspaceId)
      .eq("is_active", true),
    admin
      .from("product_aliases")
      .select("product_id,alias")
      .eq("workspace_id", workspaceId),
  ]);

  const aliasMap = new Map<string, string[]>();
  for (const row of aliases ?? []) {
    const productId = row.product_id as string;
    if (!aliasMap.has(productId)) aliasMap.set(productId, []);
    aliasMap.get(productId)!.push(row.alias as string);
  }

  return (products ?? []).map((product) => ({
    id: product.id as string,
    name: product.name as string,
    aliases: aliasMap.get(product.id as string) ?? [],
    price: Number(product.price ?? 0),
  }));
}

async function createDraft(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  customerPhone: string,
  parseResult: Awaited<ReturnType<typeof parseOrderFromMessage>>
): Promise<string | null> {
  if (parseResult.confidence < 0.55 || parseResult.items.length === 0) {
    return null;
  }

  const { data, error } = await admin
    .from("order_drafts")
    .insert({
      workspace_id: workspaceId,
      customer_phone: customerPhone,
      customer_name: parseResult.customer_name,
      items: parseResult.items,
      notes: parseResult.notes,
      confidence: parseResult.confidence,
      status: "pending_review",
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id as string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice("Bearer ".length);
    const admin = createAdminClient();
    const { data: authResult, error: authError } = await admin.auth.getUser(token);

    if (authError || !authResult.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await getCurrentWorkspaceId(authResult.user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const body = (await request.json()) as RequestBody;
    const action: Action = body.action;

    if (action === "smart_reply") {
      const payload = body as SmartReplyBody;
      const client = getOpenAIClient();
      const completion = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "You are a concise WhatsApp sales assistant for African SMBs. Keep replies short, friendly, and action-oriented.",
          },
          { role: "user", content: payload.context },
        ],
      });

      return NextResponse.json({
        reply: completion.choices[0]?.message?.content ?? "Thanks, we will get back to you shortly.",
      });
    }

    if (action === "parse_message") {
      const payload = body as ParseMessageBody;
      const catalog = await buildCatalog(admin, workspaceId);
      const parseResult = await parseOrderFromMessage(payload.message, catalog);
      const draftId = await createDraft(
        admin,
        workspaceId,
        payload.customerPhone ?? "unknown",
        parseResult
      );

      return NextResponse.json({
        draftId,
        items: parseResult.items,
        confidence: parseResult.confidence,
        transcription: payload.message,
      });
    }

    if (action === "parse_voice") {
      const payload = body as ParseVoiceBody;
      const audioBuffer = Buffer.from(payload.audioBase64, "base64");
      const mimeType = payload.mimeType ?? "audio/m4a";
      const extension = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "m4a";

      const client = getOpenAIClient();
      const file = await toFile(audioBuffer, `voice-note.${extension}`, { type: mimeType });
      const transcription = await client.audio.transcriptions.create({
        model: "gpt-4o-mini-transcribe",
        file,
      });

      const text = transcription.text?.trim() ?? "";
      if (!text) {
        return NextResponse.json({ error: "Unable to transcribe voice note" }, { status: 422 });
      }

      const catalog = await buildCatalog(admin, workspaceId);
      const parseResult = await parseOrderFromMessage(text, catalog);
      const draftId = await createDraft(
        admin,
        workspaceId,
        payload.customerPhone ?? "unknown",
        parseResult
      );

      return NextResponse.json({
        draftId,
        transcription: text,
        items: parseResult.items,
        confidence: parseResult.confidence,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("[whatsapp]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
