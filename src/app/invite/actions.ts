"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

const mapInviteError = (message?: string | null) => {
  const normalized = (message ?? "").toLowerCase();
  if (normalized.includes("expired")) return "This invite link has expired.";
  if (normalized.includes("invalid")) return "This invite link is invalid.";
  if (normalized.includes("email")) return "This invite link was sent to a different email.";
  if (normalized.includes("accepted")) return "This invite link has already been used.";
  return "We couldn’t accept this invite. Please contact your admin.";
};

export async function acceptInvite(_: { error?: string }, formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    return { error: "Invalid invite link." };
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Please sign in to accept your invite." };
  }

  const { data, error } = await supabase.rpc("accept_org_invite_by_token", {
    p_token: token,
  });

  if (error || !data?.org_id) {
    return { error: mapInviteError(error?.message) };
  }

  const orgId = data.org_id as string;
  cookieStore.set("org_id", orgId, { path: "/", sameSite: "lax" });

  await supabase.from("user_settings").upsert({
    user_id: user.id,
    active_organization_id: orgId,
  });

  redirect("/dashboard");
}
