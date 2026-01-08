import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

type OrgMembership = { org_id: string; role: string };

const createSupabaseServer = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
};

const normalizeMemberships = async (
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  userId: string
) => {
  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId);

  if (memberships && memberships.length > 0) {
    return memberships as OrgMembership[];
  }

  const { data: legacy } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId);

  if (!legacy) return [];

  return legacy.map((row) => ({
    org_id: row.organization_id as string,
    role: row.role as string,
  }));
};

export async function getCurrentOrgId() {
  const cookieStore = await cookies();
  const orgCookie = cookieStore.get("org_id")?.value;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  if (orgCookie) return orgCookie;

  const memberships = await normalizeMemberships(supabase, user.id);
  if (memberships.length === 1) {
    const orgId = memberships[0].org_id;
    cookieStore.set("org_id", orgId, { path: "/", sameSite: "lax" });
    return orgId;
  }

  return null;
}

export async function getOrgRole(orgId: string) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (data?.role) return data.role as string;

  const { data: legacy } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();

  return legacy?.role ?? null;
}

export async function requireOrgMember(orgId: string) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getOrgRole(orgId);
  if (!role) {
    redirect("/access");
  }

  return { supabase, user, role };
}
