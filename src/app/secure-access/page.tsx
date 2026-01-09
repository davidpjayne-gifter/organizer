import { requireUserAndActiveOrg } from "@/lib/server/requireOrg";
import SecureAccessClient from "./SecureAccessClient";

export default async function SecureAccessPage() {
  const { supabase, activeOrgId, user } = await requireUserAndActiveOrg();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", activeOrgId)
    .single();

  const orgName = org?.name ?? "";

  return (
    <SecureAccessClient
      orgId={activeOrgId}
      orgName={orgName}
      actorName={user.email ?? "Admin"}
    />
  );
}
