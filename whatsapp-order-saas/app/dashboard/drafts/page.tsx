import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { listDrafts } from "@/lib/actions/drafts";
import DraftsPageClient from "./DraftsPageClient";

export const metadata = { title: "AI Order Drafts" };

export default async function DraftsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { drafts = [], error } = await listDrafts("pending_review");

  return (
    <DraftsPageClient
      initialDrafts={drafts}
      fetchError={error}
    />
  );
}
