"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { logActivity } from "@/lib/activity";
import { getCurrentWorkspaceId } from "@/lib/workspace";

export interface ProductFormInput {
  name: string;
  price: number;
  imageUrl?: string;
}

export interface ProductActionState {
  error?: string;
  success?: boolean;
}

const PRICE_COLUMN_CANDIDATES = [
  "price",
  "unit_price",
  "amount",
  "product_price",
  "selling_price",
  "price_ngn",
] as const;

const OWNER_COLUMN_CANDIDATES = ["vendor_id", "owner_id"] as const;

function isMissingColumnError(message: string, column: string): boolean {
  const text = message.toLowerCase();
  return text.includes("could not find") && text.includes(`'${column.toLowerCase()}'`);
}

function buildPricePayload(column: string, price: number): Record<string, number> {
  return { [column]: price };
}

function buildOwnerPayload(column: string, ownerId: string): Record<string, string> {
  return { [column]: ownerId };
}

function isMissingImageUrlError(message: string): boolean {
  return isMissingColumnError(message, "image_url");
}

function isMissingOwnerColumnError(message: string): boolean {
  return OWNER_COLUMN_CANDIDATES.some((column) => isMissingColumnError(message, column));
}

async function requireProductAccess(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (data?.role === "delivery_manager") {
    return "Delivery managers do not have permission to modify products.";
  }
  return null;
}

export async function createProduct(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const accessError = await requireProductAccess(supabase, user.id);
  if (accessError) return { error: accessError };

  const name        = (formData.get("name")        as string)?.trim();
  const price       = parseFloat((formData.get("price") as string) ?? "0");
  const imageUrl    = (formData.get("imageUrl")    as string)?.trim() || undefined;

  if (!name)              return { error: "Product name is required." };
  if (isNaN(price) || price < 0) return { error: "Price must be 0 or more." };

  let error: { message: string } | null = null;
  const priceErrors: string[] = [];

  for (const ownerColumn of OWNER_COLUMN_CANDIDATES) {
    for (const priceColumn of PRICE_COLUMN_CANDIDATES) {
      const payload: Record<string, unknown> = {
        ...buildOwnerPayload(ownerColumn, user.id),
        name,
        ...buildPricePayload(priceColumn, price),
      };
      
      if (imageUrl) {
        payload.image_url = imageUrl;
      }

      const result = await supabase.from("products").insert(payload);
      if (!result.error) {
        error = null;
        break;
      }
      // If only the image_url column is missing, retry without it
      if (isMissingImageUrlError(result.error.message) && payload.image_url !== undefined) {
        delete payload.image_url;
        const retryResult = await supabase.from("products").insert(payload);
        if (!retryResult.error) { error = null; break; }
        error = retryResult.error;
      } else {
        error = result.error;
      }
      priceErrors.push(error.message);
    }

    if (!error) break;
    if (!isMissingColumnError(error.message, ownerColumn)) break;
  }

  if (error && isMissingOwnerColumnError(error.message)) {
    for (const column of PRICE_COLUMN_CANDIDATES) {
      const result = await supabase.from("products").insert({
        name,
        ...buildPricePayload(column, price),
      });
      if (!result.error) {
        error = null;
        break;
      }
      error = result.error;
      priceErrors.push(result.error.message);
    }

    // Final fallback only if every price column variant failed.
    if (error) {
      const fallback = await supabase.from("products").insert({ name });
      error = fallback.error;
    }
  }

  if (error) {
    const allMissingPriceColumns = PRICE_COLUMN_CANDIDATES.every((column) =>
      priceErrors.some((msg) => isMissingColumnError(msg, column))
    );

    if (allMissingPriceColumns) {
      return {
        error:
          "Your database products table has no supported price column. Run migration 004_add_products_price_column_if_missing.sql and try again.",
      };
    }
  }

  if (error) return { error: error.message };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  
  void logActivity({
    workspaceId: workspaceId ?? user.id,
    actorId: user.id,
    entityType: "product",
    action: "product_created",
    meta: { name, price },
  });

  revalidatePath("/dashboard/products");
  return { success: true };
}

export async function updateProduct(
  id: string,
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const accessError = await requireProductAccess(supabase, user.id);
  if (accessError) return { error: accessError };

  const name        = (formData.get("name")        as string)?.trim();
  const price       = parseFloat((formData.get("price") as string) ?? "0");
  const imageUrl    = (formData.get("imageUrl")    as string)?.trim() || undefined;

  if (!name) return { error: "Product name is required." };
  if (isNaN(price) || price < 0) return { error: "Price must be 0 or more." };

  let error: { message: string } | null = null;
  const priceErrors: string[] = [];

  for (const ownerColumn of OWNER_COLUMN_CANDIDATES) {
    for (const priceColumn of PRICE_COLUMN_CANDIDATES) {
      const updatePayload: Record<string, unknown> = {
        name,
        ...buildPricePayload(priceColumn, price),
      };
      
      if (imageUrl) {
        updatePayload.image_url = imageUrl;
      }

      const result = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", id)
        .eq(ownerColumn, user.id);

      if (!result.error) {
        error = null;
        break;
      }
      // If only the image_url column is missing, retry without it
      if (isMissingImageUrlError(result.error.message) && updatePayload.image_url !== undefined) {
        delete updatePayload.image_url;
        const retryResult = await supabase.from("products").update(updatePayload).eq("id", id).eq(ownerColumn, user.id);
        if (!retryResult.error) { error = null; break; }
        error = retryResult.error;
      } else {
        error = result.error;
      }
      priceErrors.push(error.message);
    }

    if (!error) break;
    if (!isMissingColumnError(error.message, ownerColumn)) break;
  }

  if (error && isMissingOwnerColumnError(error.message)) {
    for (const column of PRICE_COLUMN_CANDIDATES) {
      const updatePayload: Record<string, unknown> = {
        name,
        ...buildPricePayload(column, price),
      };
      
      if (imageUrl) {
        updatePayload.image_url = imageUrl;
      }

      const result = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", id);

      if (!result.error) {
        error = null;
        break;
      }
      error = result.error;
      priceErrors.push(result.error.message);
    }

    // Final fallback only if every price column variant failed.
    if (error) {
      const fallbackPayload: Record<string, unknown> = { name };
      if (imageUrl) {
        fallbackPayload.image_url = imageUrl;
      }

      const fallback = await supabase
        .from("products")
        .update(fallbackPayload)
        .eq("id", id);
      error = fallback.error;
    }
  }

  if (error) {
    const allMissingPriceColumns = PRICE_COLUMN_CANDIDATES.every((column) =>
      priceErrors.some((msg) => isMissingColumnError(msg, column))
    );

    if (allMissingPriceColumns) {
      return {
        error:
          "Your database products table has no supported price column. Run migration 004_add_products_price_column_if_missing.sql and try again.",
      };
    }
  }

  if (error) return { error: error.message };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  
  void logActivity({
    workspaceId: workspaceId ?? user.id,
    actorId: user.id,
    entityType: "product",
    entityId: id,
    action: "product_updated",
    meta: { name, price },
  });

  revalidatePath("/dashboard/products");
  return { success: true };
}

export async function toggleProductActive(id: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const accessError = await requireProductAccess(supabase, user.id);
  if (accessError) return { error: accessError };

  let error: { message: string } | null = null;

  for (const ownerColumn of OWNER_COLUMN_CANDIDATES) {
    const result = await supabase
      .from("products")
      .update({ is_active: isActive })
      .eq("id", id)
      .eq(ownerColumn, user.id);

    if (!result.error) {
      error = null;
      break;
    }
    error = result.error;

    if (!isMissingColumnError(result.error.message, ownerColumn)) {
      break;
    }
  }

  if (error && isMissingOwnerColumnError(error.message)) {
    const retry = await supabase
      .from("products")
      .update({ is_active: isActive })
      .eq("id", id);
    error = retry.error;
  }

  if (error) return { error: error.message };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  
  void logActivity({
    workspaceId: workspaceId ?? user.id,
    actorId: user.id,
    entityType: "product",
    entityId: id,
    action: "product_toggled",
    meta: { is_active: isActive },
  });

  revalidatePath("/dashboard/products");
  return {};
}

export async function deleteProduct(id: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const accessError = await requireProductAccess(supabase, user.id);
  if (accessError) return { error: accessError };

  let error: { message: string } | null = null;

  for (const ownerColumn of OWNER_COLUMN_CANDIDATES) {
    const result = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .eq(ownerColumn, user.id);

    if (!result.error) {
      error = null;
      break;
    }
    error = result.error;

    if (!isMissingColumnError(result.error.message, ownerColumn)) {
      break;
    }
  }

  if (error && isMissingOwnerColumnError(error.message)) {
    const retry = await supabase
      .from("products")
      .delete()
      .eq("id", id);
    error = retry.error;
  }

  if (error) return { error: error.message };

  const workspaceId = await getCurrentWorkspaceId(user.id);
  
  void logActivity({
    workspaceId: workspaceId ?? user.id,
    actorId: user.id,
    entityType: "product",
    entityId: id,
    action: "product_deleted",
    meta: {},
  });

  revalidatePath("/dashboard/products");
  return {};
}
