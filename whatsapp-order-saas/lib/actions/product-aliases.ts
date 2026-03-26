"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getWorkspacePlan, hasAiInboxCopilotAccess } from "@/lib/plans";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductAlias {
  id: string;
  product_id: string;
  alias: string;
  product_name?: string;
  created_at: string;
}

// ─── List aliases for a workspace ─────────────────────────────────────────────

export async function listProductAliases(): Promise<{
  aliases?: ProductAlias[];
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();

  // Get workspace id for this user
  const workspaceId = await resolveWorkspaceId(admin, user.id);
  if (!workspaceId) return { error: "Workspace not found." };
  const access = await assertAiAccess(admin, workspaceId);
  if (!access.ok) return { error: access.error };

  const { data, error } = await admin
    .from("product_aliases")
    .select("id, product_id, alias, created_at, products(name)")
    .eq("workspace_id", workspaceId)
    .order("alias", { ascending: true });

  if (error) return { error: error.message };

  const aliases: ProductAlias[] = (data ?? []).map((row) => ({
    id:           row.id as string,
    product_id:   row.product_id as string,
    alias:        row.alias as string,
    product_name: (row as { products?: { name?: string } }).products?.name,
    created_at:   row.created_at as string,
  }));

  return { aliases };
}

// ─── Create alias ─────────────────────────────────────────────────────────────

export async function createProductAlias(
  productId: string,
  alias: string
): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const workspaceId = await resolveWorkspaceId(admin, user.id);
  if (!workspaceId) return { error: "Workspace not found." };
  const access = await assertAiAccess(admin, workspaceId);
  if (!access.ok) return { error: access.error };

  const normalised = alias.trim().toLowerCase();
  if (!normalised) return { error: "Alias cannot be empty." };

  const { error } = await admin.from("product_aliases").insert({
    workspace_id: workspaceId,
    product_id:   productId,
    alias:        normalised,
  });

  if (error) {
    if (error.code === "23505") return { error: "That alias already exists." };
    return { error: error.message };
  }

  revalidatePath("/dashboard/settings/ai-capture");
  return {};
}

// ─── Delete alias ─────────────────────────────────────────────────────────────

export async function deleteProductAlias(aliasId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const admin = createAdminClient();
  const workspaceId = await resolveWorkspaceId(admin, user.id);
  if (!workspaceId) return { error: "Workspace not found." };
  const access = await assertAiAccess(admin, workspaceId);
  if (!access.ok) return { error: access.error };

  const { error } = await admin
    .from("product_aliases")
    .delete()
    .eq("id", aliasId)
    .eq("workspace_id", workspaceId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/settings/ai-capture");
  return {};
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function resolveWorkspaceId(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<string | null> {
  // Check if user is a workspace owner
  const { data: owner } = await admin
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (owner) return userId;

  // Otherwise look up workspace_members
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return (member?.workspace_id as string) ?? null;
}

async function assertAiAccess(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const currentPlanId = await getWorkspacePlan(admin, workspaceId);
  if (!hasAiInboxCopilotAccess(currentPlanId)) {
    return { ok: false, error: "AI Capture Settings are available on the Pro plan only." };
  }

  return { ok: true };
}
