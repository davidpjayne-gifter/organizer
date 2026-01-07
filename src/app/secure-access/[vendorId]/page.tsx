import { requireUserAndActiveOrg } from "@/lib/server/requireOrg";
import SecureAccessVendorClient from "./SecureAccessVendorClient";

export default async function VendorPage() {
  await requireUserAndActiveOrg();
  return <SecureAccessVendorClient />;
}
