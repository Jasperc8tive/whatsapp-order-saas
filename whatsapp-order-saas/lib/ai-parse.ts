/**
 * AI Order Parse Service
 *
 * Parses raw WhatsApp message text into structured order items using OpenAI.
 *
 * Confidence thresholds (per blueprint):
 *   >= 0.85  → auto-create order
 *   0.55–0.84 → create order_draft (requires staff/owner approval)
 *   < 0.55   → send clarification reply to customer
 *
 * Required env:
 *   OPENAI_API_KEY  — OpenAI API key
 *   OPENAI_MODEL    — Optional; defaults to "gpt-4o-mini"
 */

import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export interface CatalogItem {
  id: string;
  name: string;
  aliases: string[];
  price?: number;
}

export interface ParsedOrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
}

export type ParseDecision = "auto_create" | "needs_review" | "clarify";

export interface ParseResult {
  status: "parsed" | "needs_review" | "failed";
  decision: ParseDecision;
  confidence: number;
  items: ParsedOrderItem[];
  customer_name: string | null;
  notes: string | null;
  missing_fields: string[];
  clarification_question: string | null;
  raw_output: string;
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY env var.");
  return new OpenAI({ apiKey });
}

function buildSystemPrompt(catalog: CatalogItem[]): string {
  const catalogJson = catalog
    .map((c) => ({
      id: c.id,
      name: c.name,
      aliases: c.aliases,
      ...(c.price !== undefined ? { price: c.price } : {}),
    }))
    .map((c) => JSON.stringify(c))
    .join("\n");

  return `You are an AI assistant that extracts food/product orders from WhatsApp messages for a Nigerian commerce platform.

CATALOG (JSON, one item per line):
${catalogJson}

TASK:
Parse the customer's message and extract:
1. The list of products they want (match any product name or alias from catalog)
2. Quantities for each product
3. Customer name (if mentioned)
4. Any additional notes (delivery address, special requests, etc.)
5. A confidence score (0.00–1.00) for how certain you are about the order interpretation

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "confidence": 0.92,
  "items": [
    { "product_id": "<uuid from catalog>", "product_name": "<canonical name>", "quantity": <integer> }
  ],
  "customer_name": "<string or null>",
  "notes": "<string or null>",
  "missing_fields": ["<field name if ambiguous>"],
  "clarification_question": "<question to ask customer if confidence < 0.55, else null>"
}

RULES:
- Match product names and aliases case-insensitively.
- If quantity is not stated, assume 1.
- If a product cannot be matched to any catalog item, skip it and note it in missing_fields.
- Set confidence based on how clearly mappable the message is.
- If clarification_question is set, confidence must be < 0.55.
- Return ONLY valid JSON with no extra text.`;
}

export async function parseOrderFromMessage(
  messageText: string,
  catalog: CatalogItem[]
): Promise<ParseResult> {
  if (catalog.length === 0) {
    return {
      status: "failed",
      decision: "clarify",
      confidence: 0,
      items: [],
      customer_name: null,
      notes: null,
      missing_fields: ["catalog_empty"],
      clarification_question:
        "Sorry, we don't have our product catalog set up yet. Please contact us directly.",
      raw_output: "",
    };
  }

  const client = getClient();

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(catalog) },
      { role: "user", content: messageText },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";

  let parsed: {
    confidence: number;
    items: Array<{ product_id: string; product_name: string; quantity: number }>;
    customer_name: string | null;
    notes: string | null;
    missing_fields: string[];
    clarification_question: string | null;
  };

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      status: "failed",
      decision: "clarify",
      confidence: 0,
      items: [],
      customer_name: null,
      notes: null,
      missing_fields: ["parse_error"],
      clarification_question:
        "Sorry, I couldn't understand your order. Could you list the items and quantities clearly?",
      raw_output: raw,
    };
  }

  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0)));

  // Validate that items is an array and each entry has the expected shape.
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems.filter(
    (item): item is ParsedOrderItem =>
      item !== null &&
      typeof item === "object" &&
      typeof item.product_id === "string" &&
      item.product_id.length > 0 &&
      typeof item.product_name === "string" &&
      item.product_name.length > 0 &&
      typeof item.quantity === "number" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0
  );

  let decision: ParseDecision;
  let status: "parsed" | "needs_review" | "failed";

  if (confidence >= 0.85 && items.length > 0) {
    decision = "auto_create";
    status = "parsed";
  } else if (confidence >= 0.55 && items.length > 0) {
    decision = "needs_review";
    status = "needs_review";
  } else {
    decision = "clarify";
    status = "failed";
  }

  return {
    status,
    decision,
    confidence,
    items,
    customer_name: parsed.customer_name ?? null,
    notes: parsed.notes ?? null,
    missing_fields: parsed.missing_fields ?? [],
    clarification_question: parsed.clarification_question ?? null,
    raw_output: raw,
  };
}
