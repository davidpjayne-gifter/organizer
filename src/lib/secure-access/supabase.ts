import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Vendor, VendorActivityEvent } from "@/lib/secure-access/store";

type SupabaseClient = ReturnType<typeof supabaseBrowser>;

type VendorRow = {
  id: string;
  org_id: string;
  name: string | null;
  website: string | null;
  password: string | null;
  account_number: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  last_updated_at: string | null;
  last_updated_by: string | null;
  created_at: string | null;
};

type VendorActivityRow = {
  id: string;
  org_id: string;
  vendor_id: string;
  action: string | null;
  actor_name: string | null;
  created_at: string | null;
  fields_changed: string[] | null;
  note: string | null;
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `v-${crypto.randomUUID()}`;
  }
  return `v-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const mapVendorRow = (row: VendorRow): Vendor => ({
  id: row.id,
  name: row.name ?? "",
  website: row.website ?? "",
  password: row.password ?? "",
  accountNumber: row.account_number ?? "",
  contactPhone: row.contact_phone ?? "",
  contactEmail: row.contact_email ?? "",
  lastUpdatedAt: row.last_updated_at ?? new Date().toISOString(),
  lastUpdatedBy: row.last_updated_by ?? "",
});

const mapVendorActivityRow = (row: VendorActivityRow): VendorActivityEvent => ({
  id: row.id,
  vendorId: row.vendor_id,
  action: row.action ?? "",
  actorName: row.actor_name ?? "",
  createdAt: row.created_at ?? new Date().toISOString(),
  fieldsChanged: row.fields_changed ?? undefined,
  note: row.note ?? undefined,
});

export const fetchVendors = async (supabase: SupabaseClient, orgId: string) => {
  const { data, error } = await supabase
    .from("secure_access_vendors")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load vendors", error);
    return [] as Vendor[];
  }

  return (data ?? []).map((row) => mapVendorRow(row as VendorRow));
};

export const fetchVendorById = async (
  supabase: SupabaseClient,
  orgId: string,
  vendorId: string
) => {
  const { data, error } = await supabase
    .from("secure_access_vendors")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", vendorId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load vendor", error);
    return null;
  }

  if (!data) return null;
  return mapVendorRow(data as VendorRow);
};

export const fetchVendorActivity = async (
  supabase: SupabaseClient,
  orgId: string,
  vendorId: string
) => {
  const { data, error } = await supabase
    .from("secure_access_activity")
    .select("*")
    .eq("org_id", orgId)
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load vendor activity", error);
    return [] as VendorActivityEvent[];
  }

  return (data ?? []).map((row) => mapVendorActivityRow(row as VendorActivityRow));
};

export const createVendor = async (
  supabase: SupabaseClient,
  orgId: string,
  input: Omit<Vendor, "id" | "lastUpdatedAt" | "lastUpdatedBy">,
  actorName: string
) => {
  const now = new Date().toISOString();
  const vendorId = createId();
  const { data, error } = await supabase
    .from("secure_access_vendors")
    .insert({
      id: vendorId,
      org_id: orgId,
      name: input.name,
      website: input.website,
      password: input.password,
      account_number: input.accountNumber,
      contact_phone: input.contactPhone,
      contact_email: input.contactEmail,
      last_updated_at: now,
      last_updated_by: actorName,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to create vendor", error);
    throw error ?? new Error("Failed to create vendor");
  }

  await logVendorEvent(supabase, orgId, vendorId, {
    action: "Vendor created",
    actorName,
  });

  return mapVendorRow(data as VendorRow);
};

export const updateVendor = async (
  supabase: SupabaseClient,
  orgId: string,
  vendorId: string,
  patch: Partial<Omit<Vendor, "id" | "lastUpdatedAt" | "lastUpdatedBy">>,
  actorName: string,
  fieldsChanged?: string[]
) => {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    last_updated_at: now,
    last_updated_by: actorName,
  };

  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.website !== undefined) updates.website = patch.website;
  if (patch.password !== undefined) updates.password = patch.password;
  if (patch.accountNumber !== undefined) updates.account_number = patch.accountNumber;
  if (patch.contactPhone !== undefined) updates.contact_phone = patch.contactPhone;
  if (patch.contactEmail !== undefined) updates.contact_email = patch.contactEmail;

  const { data, error } = await supabase
    .from("secure_access_vendors")
    .update(updates)
    .eq("org_id", orgId)
    .eq("id", vendorId)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Failed to update vendor", error);
    throw error ?? new Error("Failed to update vendor");
  }

  await logVendorEvent(supabase, orgId, vendorId, {
    action: "Vendor updated",
    actorName,
    fieldsChanged,
  });

  return mapVendorRow(data as VendorRow);
};

export const deleteVendor = async (supabase: SupabaseClient, orgId: string, vendorId: string) => {
  const { error } = await supabase
    .from("secure_access_vendors")
    .delete()
    .eq("org_id", orgId)
    .eq("id", vendorId);

  if (error) {
    console.error("Failed to delete vendor", error);
    throw error;
  }
};

export const logVendorEvent = async (
  supabase: SupabaseClient,
  orgId: string,
  vendorId: string,
  event: Omit<VendorActivityEvent, "id" | "vendorId" | "createdAt">
) => {
  const { error } = await supabase.from("secure_access_activity").insert({
    org_id: orgId,
    vendor_id: vendorId,
    action: event.action,
    actor_name: event.actorName,
    fields_changed: event.fieldsChanged ?? [],
    note: event.note ?? null,
  });

  if (error) {
    console.error("Failed to log vendor activity", error);
  }
};
