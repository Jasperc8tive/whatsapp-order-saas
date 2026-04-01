
"use client";
import { useEffect, useState } from "react";
import { offlineDB } from "@/lib/utils";

export function useOfflineProducts() {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const all = await offlineDB.getProducts?.() || [];
      if (mounted) setProducts(all.filter((p) => p.offline));
    }
    load();
    window.addEventListener("offline-product-changed", load);
    return () => {
      mounted = false;
      window.removeEventListener("offline-product-changed", load);
    };
  }, []);
  return products;
}
