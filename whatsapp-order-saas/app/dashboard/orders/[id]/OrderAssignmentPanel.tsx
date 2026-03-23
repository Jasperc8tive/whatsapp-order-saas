"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignOrder, unassignOrder } from "@/lib/actions/assignments";

export interface AssignableMember {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
}

interface Props {
  orderId: string;
  currentAssigneeId: string | null;
  members: AssignableMember[];
}

export default function OrderAssignmentPanel({ orderId, currentAssigneeId, members }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    startTransition(async () => {
      if (value === "") {
        await unassignOrder(orderId);
      } else {
        await assignOrder(orderId, value);
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Assigned To</h3>
      <select
        value={currentAssigneeId ?? ""}
        onChange={handleChange}
        disabled={isPending || members.length === 0}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
      >
        <option value="">— Unassigned —</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name ?? m.email ?? m.user_id.slice(0, 12)} ({m.role})
          </option>
        ))}
      </select>
      {members.length === 0 && (
        <p className="mt-2 text-xs text-gray-400">Add team members to enable assignment.</p>
      )}
    </div>
  );
}
