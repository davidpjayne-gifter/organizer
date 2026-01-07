import DashboardClient from "./DashboardClient";
import { requireUserAndActiveOrg } from "@/lib/server/requireOrg";

export default async function DashboardPage() {
  const { supabase, user, activeOrgId } = await requireUserAndActiveOrg();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", activeOrgId)
    .single();

  if (!org) {
    return <DashboardClient orgId={activeOrgId} orgName="" email={user.email ?? ""} />;
  }

  return <DashboardClient orgId={org.id} orgName={org.name} email={user.email ?? ""} />;
}
