"use client";

import { CustomerRow } from "@/components/BulkActionsBar";
import { useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

// Nigeria phone number validation utility
function isValidNigerianPhone(phone: string): boolean {
  const local = /^(080|070|081|090|091)\d{8}$/;
  const intl = /^\+234(80|70|81|90|91)\d{8}$/;
  return local.test(phone) || intl.test(phone);
}

export default function ImportCustomersButton({ vendorId, onDone }: ImportCustomersButtonProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    const customers = rows.slice(1).map(row => {
      const [name, phone] = row.split(",");
      return { name: name?.trim(), phone: phone?.trim() };
    });
    const valid = customers.filter(c => c.name && isValidNigerianPhone(c.phone));
    if (!valid.length) {
      alert("No valid customers found in file.");
      return;
    }
    await supabase.from("customers").insert(valid.map(c => ({ ...c, vendor_id: vendorId })));
    if (onDone) onDone();
    window.location.reload();
  }

  return (
    <>
      <button
        onClick={() => fileInput.current?.click()}
        className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1 rounded-lg ml-2"
      >
        Import CSV
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleFile}
      />
    </>
  );
}

interface ImportCustomersButtonProps {
  vendorId: string;
  onDone: () => void;
}
