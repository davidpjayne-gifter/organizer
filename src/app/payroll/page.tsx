import { requireUserAndActiveOrg } from "@/lib/server/requireOrg";
import PayrollClient from "./PayrollClient";

export default async function PayrollPage() {
  const { supabase, user, activeOrgId } = await requireUserAndActiveOrg();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", activeOrgId)
    .single();

  const orgName = org?.name ?? "";

  return (
    <PayrollClient orgId={activeOrgId} orgName={orgName} actorName={user.email ?? "Admin"} />
  );
}
