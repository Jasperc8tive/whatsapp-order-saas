import { createAdminClient } from "@/lib/supabaseAdmin";
import { sendTextMessage } from "@/lib/whatsapp";
import { enqueueJob } from "@/lib/jobs";

export type AutomationTrigger =
  | "order_created"
  | "order_status_changed"
  | "payment_pending"
  | "payment_confirmed"
  | "delivery_status_changed"
  | "no_customer_response";

export interface AutomationEventPayload {
  workspaceId: string;
  trigger: AutomationTrigger;
  entityType: "order" | "payment" | "delivery" | "draft" | "customer";
  entityId?: string;
  meta?: Record<string, unknown>;
}

interface RuleRow {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  cooldown_seconds: number;
}

export async function runAutomationForEvent(event: AutomationEventPayload): Promise<void> {
  const admin = createAdminClient();

  const { data: rules } = await admin
    .from("automation_rules")
    .select("id, name, trigger, conditions, actions, cooldown_seconds")
    .eq("workspace_id", event.workspaceId)
    .eq("trigger", event.trigger)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  for (const rule of (rules ?? []) as unknown as RuleRow[]) {
    const runMeta = {
      trigger: event.trigger,
      event_meta: event.meta ?? {},
      rule_name: rule.name,
    };

    const { data: runRow, error: runCreateError } = await admin
      .from("automation_runs")
      .insert({
        workspace_id: event.workspaceId,
        rule_id: rule.id,
        entity_type: event.entityType,
        entity_id: event.entityId ?? null,
        status: "running",
        meta: runMeta,
      })
      .select("id")
      .single();

    if (runCreateError || !runRow) {
      continue;
    }

    const finalizeRun = async (status: "skipped" | "succeeded" | "failed", error?: string) => {
      await admin
        .from("automation_runs")
        .update({
          status,
          error: error ?? null,
          meta: runMeta,
        })
        .eq("id", runRow.id);
    };

    const canRun = await shouldRunRule(admin, rule, event);
    if (!canRun.ok) {
      await finalizeRun("skipped", canRun.reason);
      continue;
    }

    try {
      await executeActions(admin, rule, event);
      await finalizeRun("succeeded");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await finalizeRun("failed", message);
    }
  }
}

async function shouldRunRule(
  admin: ReturnType<typeof createAdminClient>,
  rule: RuleRow,
  event: AutomationEventPayload
): Promise<{ ok: boolean; reason?: string }> {
  if (rule.cooldown_seconds > 0) {
    const afterIso = new Date(Date.now() - rule.cooldown_seconds * 1000).toISOString();

    const { data: recent } = await admin
      .from("automation_runs")
      .select("id")
      .eq("rule_id", rule.id)
      .eq("entity_type", event.entityType)
      .eq("entity_id", event.entityId ?? null)
      .eq("status", "succeeded")
      .gte("created_at", afterIso)
      .limit(1)
      .maybeSingle();

    if (recent) {
      return { ok: false, reason: "cooldown_active" };
    }
  }

  const conditions = rule.conditions ?? {};
  const meta = event.meta ?? {};

  const statusIn = conditions.status_in;
  if (Array.isArray(statusIn)) {
    const status = String(meta.new_status ?? meta.status ?? "");
    if (!statusIn.map(String).includes(status)) {
      return { ok: false, reason: "condition_status_in_failed" };
    }
  }

  const minTotal = conditions.min_total_amount;
  if (typeof minTotal === "number") {
    const total = Number(meta.total_amount ?? 0);
    if (total < minTotal) return { ok: false, reason: "condition_min_total_failed" };
  }

  const confidenceGte = conditions.confidence_gte;
  if (typeof confidenceGte === "number") {
    const confidence = Number(meta.confidence ?? 0);
    if (confidence < confidenceGte) {
      return { ok: false, reason: "condition_confidence_failed" };
    }
  }

  return { ok: true };
}

async function executeActions(
  admin: ReturnType<typeof createAdminClient>,
  rule: RuleRow,
  event: AutomationEventPayload
): Promise<void> {
  for (const action of rule.actions ?? []) {
    const type = String(action.type ?? "");

    if (type === "send_whatsapp_text") {
      await runSendWhatsAppAction(admin, action, event);
      continue;
    }

    if (type === "enqueue_job") {
      const queueName = String(action.queue_name ?? "");
      const payload = (action.payload ?? {}) as Record<string, unknown>;
      if (queueName) await enqueueJob(queueName, payload);
      continue;
    }

    if (type === "log_activity") {
      await admin.from("activity_logs").insert({
        workspace_id: event.workspaceId,
        actor_id: null,
        entity_type: event.entityType,
        entity_id: event.entityId ?? null,
        action: String(action.action ?? "automation_event"),
        meta: {
          rule_id: rule.id,
          trigger: event.trigger,
          payload: event.meta ?? {},
        },
      });
    }
  }
}

async function runSendWhatsAppAction(
  admin: ReturnType<typeof createAdminClient>,
  action: Record<string, unknown>,
  event: AutomationEventPayload
): Promise<void> {
  const to = String(action.to ?? "");
  const template = String(action.message ?? "");
  if (!template) return;

  const vars = await resolveTemplateVars(admin, event);
  const message = interpolateTemplate(template, vars);

  if (to === "owner") {
    const { data: owner } = await admin
      .from("users")
      .select("phone")
      .eq("id", event.workspaceId)
      .maybeSingle();

    const phone = (owner?.phone as string | null) ?? null;
    if (phone) await sendTextMessage(phone, message);
    return;
  }

  if (to === "customer") {
    const customerPhone = vars.customer_phone;
    if (customerPhone) await sendTextMessage(customerPhone, message);
  }
}

async function resolveTemplateVars(
  admin: ReturnType<typeof createAdminClient>,
  event: AutomationEventPayload
): Promise<Record<string, string>> {
  const out: Record<string, string> = {
    entity_id: event.entityId ?? "",
  };

  if (event.entityType === "order" && event.entityId) {
    const { data: order } = await admin
      .from("orders")
      .select("id, total_amount, customers(phone, name)")
      .eq("id", event.entityId)
      .maybeSingle();

    const customer = (order?.customers as { phone?: string; name?: string } | null) ?? null;

    out.order_ref = (order?.id as string | undefined)?.slice(0, 8).toUpperCase() ?? "";
    out.total_amount = String(Number(order?.total_amount ?? 0));
    out.customer_phone = customer?.phone ?? "";
    out.customer_name = customer?.name ?? "";
  }

  const meta = event.meta ?? {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = String(value ?? "");
  }

  return out;
}

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}
