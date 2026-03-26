import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { requireEnvValue } from "@/lib/env";

function getSiteOrigin(): string {
  const siteOrigin = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  return requireEnvValue(siteOrigin, "SITE_URL or NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
}

export function buildTeamInvitationAcceptLink(token: string): string {
  return `${getSiteOrigin()}/team/accept?token=${token}`;
}

function buildTeamInvitationRedirectTo(token: string): string {
  const next = `/team/accept?token=${token}`;
  return `${getSiteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

function createPublicSupabaseClient() {
  const supabaseUrl = requireEnvValue(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnvValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export type InvitationDeliveryResult = {
  ok: boolean;
  channel?: "invite" | "magiclink";
  acceptLink: string;
  error?: string;
};

export async function sendWorkspaceInvitationEmail(params: {
  email: string;
  role: "staff" | "delivery_manager";
  token: string;
}): Promise<InvitationDeliveryResult> {
  const admin = createAdminClient();
  const acceptLink = buildTeamInvitationAcceptLink(params.token);
  const redirectTo = buildTeamInvitationRedirectTo(params.token);

  const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    return {
      ok: false,
      acceptLink,
      error: listError.message,
    };
  }

  const existingAuthUser = listedUsers.users.find(
    (candidate) => candidate.email?.toLowerCase() === params.email.toLowerCase()
  );

  if (existingAuthUser) {
    const publicClient = createPublicSupabaseClient();
    const { error } = await publicClient.auth.signInWithOtp({
      email: params.email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: false,
      },
    });

    return {
      ok: !error,
      channel: error ? undefined : "magiclink",
      acceptLink,
      error: error?.message,
    };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(params.email, {
    redirectTo,
    data: {
      invited_to_workspace: true,
      workspace_role: params.role,
    },
  });

  return {
    ok: !error,
    channel: error ? undefined : "invite",
    acceptLink,
    error: error?.message,
  };
}
