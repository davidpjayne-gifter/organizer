"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { getCurrentOrgId, getOrgRole } from "@/lib/org";

type InviteState = {
  error?: string;
  inviteLink?: string;
  email?: string;
};

const isValidRole = (role: string) => role === "member" || role === "admin";

const isValidEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

const getBaseUrl = () => {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
};

export async function createInvite(_: InviteState, formData: FormData): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member").trim();

  if (!isValidEmail(email)) {
    return { error: "Enter a valid email address." };
  }

  if (!isValidRole(role)) {
    return { error: "Role must be member or admin." };
  }

  const orgId = await getCurrentOrgId();
  if (!orgId) {
    return { error: "Select an organization before inviting." };
  }

  const orgRole = await getOrgRole(orgId);
  if (!orgRole || !["admin", "owner"].includes(orgRole)) {
    return { error: "You don’t have permission to invite members." };
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies().getAll(),
        setAll: () => {},
      },
    }
  );

  const { data, error } = await supabase.rpc("create_org_invite", {
    p_org_id: orgId,
    p_email: email,
    p_role: role,
    p_expires_in_hours: 168,
  });

  if (error || !data) {
    return { error: "Unable to create invite. Please try again." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.token) {
    return { error: "Unable to create invite link." };
  }

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return { error: "Missing app URL configuration." };
  }

  const inviteLink = `${baseUrl}/invite?token=${row.token}`;
  return { inviteLink, email };
}

type TransferState = {
  error?: string;
  success?: string;
};

export async function transferOwnership(
  _: TransferState,
  formData: FormData
): Promise<TransferState> {
  const newOwnerUserId = String(formData.get("new_owner_user_id") ?? "").trim();
  if (!newOwnerUserId) {
    return { error: "Select a member to transfer ownership." };
  }

  const orgId = await getCurrentOrgId();
  if (!orgId) {
    return { error: "Select an organization before transferring ownership." };
  }

  const orgRole = await getOrgRole(orgId);
  if (orgRole !== "owner") {
    return { error: "Only the current owner can transfer ownership." };
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies().getAll(),
        setAll: () => {},
      },
    }
  );

  const { error } = await supabase.rpc("transfer_org_ownership", {
    p_org_id: orgId,
    p_new_owner_user_id: newOwnerUserId,
  });

  if (error) {
    return { error: error.message || "Unable to transfer ownership." };
  }

  revalidatePath("/settings/members");
  return { success: "Ownership transferred successfully." };
}
