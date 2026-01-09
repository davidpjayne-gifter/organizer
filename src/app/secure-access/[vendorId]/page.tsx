import { requireUserAndActiveOrg } from "@/lib/server/requireOrg";
import SecureAccessVendorClient from "./SecureAccessVendorClient";

export default async function VendorPage() {
  const { activeOrgId, user } = await requireUserAndActiveOrg();
  return (
    <SecureAccessVendorClient
      orgId={activeOrgId}
      actorName={user.email ?? "Admin"}
    />
  );
}
