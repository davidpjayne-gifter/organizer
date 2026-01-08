"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export async function setCurrentOrg(_: unknown, formData: FormData) {
  const orgId = String(formData.get("org_id") ?? "").trim();
  if (!orgId) {
    return { error: "Select an organization." };
  }

  const cookieStore = cookies();
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
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  let isMember = Boolean(membership);

  if (!isMember) {
    const { data: legacy } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    isMember = Boolean(legacy);
  }

  if (!isMember) {
    return { error: "You don’t have access to that organization." };
  }

  cookieStore.set("org_id", orgId, { path: "/", sameSite: "lax" });
  redirect("/dashboard");
}
