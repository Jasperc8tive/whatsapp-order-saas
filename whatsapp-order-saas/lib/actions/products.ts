"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabaseServer";

export interface ProductFormInput {
  name: string;
  price: number;
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

  if (!name)              return { error: "Product name is required." };
  if (isNaN(price) || price < 0) return { error: "Price must be 0 or more." };

  let error: { message: string } | null = null;
  const priceErrors: string[] = [];

  for (const ownerColumn of OWNER_COLUMN_CANDIDATES) {
    for (const priceColumn of PRICE_COLUMN_CANDIDATES) {
      const payload = {
        ...buildOwnerPayload(ownerColumn, user.id),
        name,
        ...buildPricePayload(priceColumn, price),
      };

      const result = await supabase.from("products").insert(payload);
      if (!result.error) {
        error = null;
        break;
      }
      error = result.error;
      priceErrors.push(result.error.message);
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

  if (!name) return { error: "Product name is required." };
  if (isNaN(price) || price < 0) return { error: "Price must be 0 or more." };

  let error: { message: string } | null = null;
  const priceErrors: string[] = [];

  for (const ownerColumn of OWNER_COLUMN_CANDIDATES) {
    for (const priceColumn of PRICE_COLUMN_CANDIDATES) {
      const result = await supabase
        .from("products")
        .update({ name, ...buildPricePayload(priceColumn, price) })
        .eq("id", id)
        .eq(ownerColumn, user.id);

      if (!result.error) {
        error = null;
        break;
      }
      error = result.error;
      priceErrors.push(result.error.message);
    }

    if (!error) break;
    if (!isMissingColumnError(error.message, ownerColumn)) break;
  }

  if (error && isMissingOwnerColumnError(error.message)) {
    for (const column of PRICE_COLUMN_CANDIDATES) {
      const result = await supabase
        .from("products")
        .update({ name, ...buildPricePayload(column, price) })
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
      const fallback = await supabase
        .from("products")
        .update({ name })
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

  revalidatePath("/dashboard/products");
  return {};
}
