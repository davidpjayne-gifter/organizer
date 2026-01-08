import DashboardClient from "./DashboardClient";
import { requireUserAndActiveOrg } from "@/lib/server/requireOrg";
import { getOrgRole } from "@/lib/org";

export default async function DashboardPage() {
  const { supabase, user, activeOrgId } = await requireUserAndActiveOrg();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", activeOrgId)
    .single();

  if (!org) {
    return (
      <DashboardClient
        orgId={activeOrgId}
        orgName=""
        email={user.email ?? ""}
        members={[]}
        invites={[]}
        isOrgAdmin={false}
      />
    );
  }

  const role = await getOrgRole(org.id);
  const isOrgAdmin = role === "owner" || role === "admin";

  const { data: invites } = await supabase
    .from("org_invites")
    .select("id, email, role, created_at, expires_at, accepted_at, revoked_at")
    .eq("org_id", org.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  let members =
    (
      await supabase
        .from("org_members")
        .select("user_id, role, created_at")
        .eq("org_id", org.id)
        .order("created_at", { ascending: true })
    ).data ?? [];

  if (members.length === 0) {
    const { data: legacyMembers } = await supabase
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: true });
    members = legacyMembers ?? [];
  }

  return (
    <DashboardClient
      orgId={org.id}
      orgName={org.name}
      email={user.email ?? ""}
      members={members ?? []}
      invites={invites ?? []}
      isOrgAdmin={isOrgAdmin}
    />
  );
}
