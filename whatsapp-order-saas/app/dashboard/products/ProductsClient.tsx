"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { formatCurrency } from "@/lib/utils";
import { AddOfflineProductModal } from "@/components/AddOfflineProductModal";
import {
  createProduct,
  updateProduct,
  toggleProductActive,
  deleteProduct,
  type ProductActionState,
} from "@/lib/actions/products";

interface Product {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  image_url?: string | null;
  created_at: string;
}

function SubmitBtn({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
      {pending && <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
      {pending ? pendingLabel : label}
    </button>
  );
}

function ProductForm({
  onClose,
  editing,
}: {
  onClose: () => void;
  editing?: Product;
}) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState(editing?.image_url || "");
  const [showOfflineForm, setShowOfflineForm] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const action = editing
    ? updateProduct.bind(null, editing.id)
    : createProduct;

  const [state, formAction] = useActionState<ProductActionState, FormData>(action, {});

  useEffect(() => {
    if (state.success) onClose();
  }, [state.success, onClose]);

  if (state.success) return null;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setIsUploadingImage(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // Create a FormData to send file to our upload endpoint
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);

      const response = await fetch("/api/upload-product-image", {
        method: "POST",
        body: uploadFormData,
      });

      if (!response.ok) {
        const error = await response.json();
        setUploadError("Failed to upload image: " + (error.message || "Unknown error"));
        setImageFile(null);
        setIsUploadingImage(false);
        return;
      }

      const data = await response.json();
      setImageUrl(data.imageUrl);
      setUploadSuccess("Image uploaded successfully.");
    } catch (error) {
      console.error("Image upload error:", error);
      setUploadError("Failed to upload image");
      setImageFile(null);
    } finally {
      setIsUploadingImage(false);
      <AddOfflineProductModal open={showOfflineForm} onClose={() => setShowOfflineForm(false)} />
    }
  }

  async function handleFormSubmit(formDataToSubmit: FormData) {
    // Always send imageUrl so the server knows when it has been cleared
    formDataToSubmit.set("imageUrl", imageUrl);
    formAction(formDataToSubmit);
  }

  return (
    <form action={handleFormSubmit} className="space-y-4">
      {state.error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{state.error}</p>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Product Name <span className="text-red-400">*</span></label>
        <input name="name" defaultValue={editing?.name} required autoComplete="off"
          placeholder="e.g. Jollof Rice Pack"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Price (₦)</label>
        <input name="price" type="number" min="0" step="0.01"
          defaultValue={editing?.price ?? 0}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Product Image</label>
        {imageUrl && (
          <div className="mb-3 relative h-32">
            <Image src={imageUrl} alt="Product preview" fill unoptimized className="object-cover rounded-lg border border-gray-200" />
            <button
              type="button"
              onClick={() => {
                setImageUrl("");
                setImageFile(null);
              }}
              className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
            >
              ✕
            </button>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={isUploadingImage}
          className="w-full text-sm text-gray-500
            file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-gray-200
            file:text-sm file:font-medium file:bg-gray-50 file:text-gray-700
            hover:file:bg-gray-100 disabled:opacity-50"
        />
        {isUploadingImage && <p className="text-xs text-gray-500 mt-2">Uploading image...</p>}
        {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}
        {uploadSuccess && <p className="text-xs text-green-600 mt-2">{uploadSuccess}</p>}
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose}
          className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <div className="flex-1">
          <SubmitBtn label={editing ? "Save" : "Add Product"} pendingLabel={editing ? "Saving…" : "Adding…"} />
        </div>
      </div>
    </form>
  );
}

function ProductCard({ product, highlighted, onSave }: { product: Product; highlighted?: boolean; onSave: () => void }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      await toggleProductActive(product.id, !product.is_active);
      onSave();
    });
  }

  function handleDelete() {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteProduct(product.id);
      onSave();
    });
  }

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Edit Product</h3>
        <ProductForm editing={product} onClose={() => { setEditing(false); onSave(); }} />
      </div>
    );
  }

  return (
    <div
      id={`product-${product.id}`}
      className={`bg-white rounded-xl border p-4 flex gap-4 ${
        highlighted
          ? "border-amber-300 ring-2 ring-amber-100"
          : !product.is_active
          ? "opacity-60"
          : "border-gray-200"
      }`}
    >
      {/* Image or placeholder */}
      <div className="w-14 h-14 rounded-lg flex-shrink-0 bg-gray-100 overflow-hidden relative">
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill unoptimized className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{product.name}</p>
            {highlighted && (
              <p className="mt-1 text-[11px] font-medium text-amber-700">Recommended product</p>
            )}
          </div>
          <p className="text-sm font-bold text-gray-900 flex-shrink-0">{formatCurrency(product.price)}</p>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <button onClick={toggle} disabled={isPending}
            className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
              product.is_active
                ? "bg-green-50 text-green-700 hover:bg-green-100"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>
            {product.is_active ? "Active" : "Inactive"}
          </button>
          <button onClick={() => setEditing(true)}
            className="text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors">Edit</button>
          <button onClick={handleDelete} disabled={isPending}
            className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsClient({
  initialProducts,
  highlightProductId,
}: {
  initialProducts: Product[];
  highlightProductId?: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  function closeAndRefresh() {
    setShowForm(false);
    router.refresh();
  }

  useEffect(() => {
    if (!highlightProductId) return;

    const element = document.getElementById(`product-${highlightProductId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightProductId]);

  return (
    <div>
      {highlightProductId && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Highlighted product from AI recommendation.
        </div>
      )}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Products</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {initialProducts.length === 0
              ? "No products yet"
              : `${initialProducts.length} product${initialProducts.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Product
        </button>
      </div>

      {/* Add product panel */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">New Product</h3>
          <ProductForm onClose={closeAndRefresh} />
        </div>
      )}

      {initialProducts.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-700 mb-1">No products yet</p>
          <p className="text-xs text-gray-400 mb-4">Add products to your catalogue and they&apos;ll appear on your storefront.</p>
          <button onClick={() => setShowForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Add your first product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {initialProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              highlighted={p.id === highlightProductId}
              onSave={closeAndRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
