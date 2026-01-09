"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getWebsiteDomain,
  Vendor,
  VendorActivityEvent,
} from "@/lib/secure-access/store";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { createVendor, fetchVendors } from "@/lib/secure-access/supabase";
import { EmptyState } from "@/components/ui/EmptyState";
import { NativeMessage } from "@/components/ui/NativeMessage";

const emptyForm = {
  name: "",
  website: "",
  password: "",
  accountNumber: "",
  contactPhone: "",
  contactEmail: "",
};

interface SecureAccessClientProps {
  orgId: string;
  orgName: string;
  actorName: string;
}

const LOCAL_STORAGE_KEY = "organizer_secure_access_v1";

const readLocalSecureAccessState = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as {
      vendors: Vendor[];
      activityByVendorId: Record<string, VendorActivityEvent[]>;
    };
  } catch {
    return null;
  }
};

export default function SecureAccessClient({
  orgId,
  orgName,
  actorName,
}: SecureAccessClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formReveal, setFormReveal] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [migrationReady, setMigrationReady] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );

  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const fetched = await fetchVendors(supabase, orgId);
      if (!isMounted) return;
      setVendors(fetched);
      setShowCreateForm(fetched.length === 0);

      const localState = readLocalSecureAccessState();
      const localVendors = localState?.vendors ?? [];
      const migratedFlag = window.localStorage.getItem(`organizer_secure_access_migrated_${orgId}`);
      if (!migratedFlag && fetched.length === 0 && localVendors.length > 0) {
        setMigrationReady(true);
      } else {
        setMigrationReady(false);
      }
    }

    load().catch((error) => {
      console.error(error);
      setToast("Unable to load vendors.");
    });

    return () => {
      isMounted = false;
    };
  }, [orgId, supabase]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timeout);
  }, [toast]);

  const filteredVendors = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return vendors;
    return vendors.filter((vendor) => {
      const haystack = `${vendor.name} ${vendor.website} ${vendor.contactEmail}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [vendors, search]);

  const bestMatchId = useMemo(() => {
    if (!search.trim()) return "";
    return filteredVendors[0]?.id ?? "";
  }, [filteredVendors, search]);

  useEffect(() => {
    if (!bestMatchId) return;
    const row = rowRefs.current[bestMatchId];
    if (row) {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [bestMatchId, filteredVendors.length]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = {
      name: form.name.trim(),
      website: form.website.trim(),
      password: form.password.trim(),
      accountNumber: form.accountNumber.trim(),
      contactPhone: form.contactPhone.trim(),
      contactEmail: form.contactEmail.trim(),
    };

    const missing = Object.values(trimmed).some((value) => !value);
    if (missing) {
      setToast("Please fill out all required fields.");
      return;
    }

    try {
      const vendor = await createVendor(supabase, orgId, trimmed, actorName);

      const refreshed = await fetchVendors(supabase, orgId);
      setVendors(refreshed);
      setSearch("");
      setForm(emptyForm);
      setFormReveal(false);
      setToast("Vendor profile created.");
      setShowCreateForm(false);
      router.push(`/secure-access/${vendor.id}`);
    } catch (error) {
      console.error(error);
      setToast("Unable to create vendor profile.");
    }
  }

  function handleClear() {
    setForm(emptyForm);
    setFormReveal(false);
    setShowCreateForm(false);
  }

  async function handleMigrateLocal() {
    setMigrationStatus("running");
    try {
      const localState = readLocalSecureAccessState();
      const localVendors = localState?.vendors ?? [];
      if (localVendors.length === 0) {
        setMigrationReady(false);
        setMigrationStatus("done");
        return;
      }

      const vendorRows = localVendors.map((vendor) => ({
        id: vendor.id,
        org_id: orgId,
        name: vendor.name,
        website: vendor.website,
        password: vendor.password,
        account_number: vendor.accountNumber,
        contact_phone: vendor.contactPhone,
        contact_email: vendor.contactEmail,
        last_updated_at: vendor.lastUpdatedAt,
        last_updated_by: vendor.lastUpdatedBy,
      }));

      const { error: vendorError } = await supabase
        .from("secure_access_vendors")
        .upsert(vendorRows, { onConflict: "id" });

      if (vendorError) throw vendorError;

      const activityRows = Object.entries(localState?.activityByVendorId ?? {}).flatMap(
        ([vendorId, events]) =>
          (events ?? []).map((event) => ({
            org_id: orgId,
            vendor_id: vendorId,
            action: event.action,
            actor_name: event.actorName,
            created_at: event.createdAt,
            fields_changed: event.fieldsChanged ?? [],
            note: event.note ?? null,
          }))
      );

      if (activityRows.length > 0) {
        const { error: activityError } = await supabase
          .from("secure_access_activity")
          .insert(activityRows);
        if (activityError) throw activityError;
      }

      window.localStorage.setItem(`organizer_secure_access_migrated_${orgId}`, "true");
      const refreshed = await fetchVendors(supabase, orgId);
      setVendors(refreshed);
      setMigrationReady(false);
      setMigrationStatus("done");
      setToast("Local vendor data backed up to Supabase.");
    } catch (error) {
      console.error(error);
      setMigrationStatus("error");
      setToast("Unable to back up local vendor data.");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      const first = filteredVendors[0];
      if (first) {
        router.push(`/secure-access/${first.id}`);
      }
    }
  }

  return (
    <main className="min-h-screen p-6">
      <div className="mb-6 text-center">
        <div className="text-2xl font-semibold">Secure Access Notes</div>
        <div className="text-sm opacity-70">ORG: {orgName}</div>
        <button
          className="mt-3 text-sm underline opacity-80 hover:opacity-100"
          onClick={() => router.push("/dashboard")}
        >
          Back to dashboard
        </button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {showCreateForm ? (
          <section className="lg:w-1/3 lg:sticky lg:top-6 h-fit">
            <div className="rounded-2xl border p-6 space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Create New Vendor Profile</h1>
                <p className="text-sm opacity-80 mt-1">
                  Add a vendor and keep secure access details scoped to {orgName}.
                </p>
              </div>

              {toast ? (
                <NativeMessage
                  title={toast}
                  tone={toast.toLowerCase().includes("please") ? "warning" : "success"}
                />
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide opacity-70">Vendor Name</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="Acme Logistics"
                    required
                    type="text"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide opacity-70">Website</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    value={form.website}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, website: event.target.value }))
                    }
                    placeholder="https://acme.com"
                    required
                    type="url"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide opacity-70">Password</label>
                  <div className="flex gap-2">
                    <input
                      className="w-full rounded-xl border px-3 py-2"
                      value={form.password}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      placeholder="Enter password"
                      required
                      type={formReveal ? "text" : "password"}
                    />
                    <button
                      className="btn btn-sm"
                      type="button"
                      onClick={() => setFormReveal((prev) => !prev)}
                    >
                      {formReveal ? "Hide" : "Reveal"}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide opacity-70">Account Number</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    value={form.accountNumber}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, accountNumber: event.target.value }))
                    }
                    placeholder="AC-10290"
                    required
                    type="text"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide opacity-70">Contact Phone</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    value={form.contactPhone}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, contactPhone: event.target.value }))
                    }
                    placeholder="+1 (555) 123-0000"
                    required
                    type="tel"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide opacity-70">Contact Email</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2"
                    value={form.contactEmail}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, contactEmail: event.target.value }))
                    }
                    placeholder="admin@vendor.com"
                    required
                    type="email"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button className="btn btn-primary w-full" type="submit">
                    Create Vendor
                  </button>
                  <button className="btn w-full" type="button" onClick={handleClear}>
                    Clear
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        <section className="lg:flex-1">
          <div className="rounded-2xl border p-6 space-y-4 h-full">
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-semibold">Vendor Directory</div>
                  <div className="text-sm opacity-80">
                    Type to filter. Click a vendor to view.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                  >
                    Create Vendor
                  </button>
                  <div className="text-xs opacity-60">{vendors.length} vendors</div>
                </div>
              </div>
              {migrationReady ? (
                <div className="mt-4">
                  <NativeMessage
                    title="Local vendor data found"
                    body="Back it up to Supabase so it’s available across devices."
                    actions={
                      <button
                        className="btn btn-sm"
                        type="button"
                        onClick={handleMigrateLocal}
                        disabled={migrationStatus === "running"}
                      >
                        {migrationStatus === "running" ? "Backing up…" : "Back up local data"}
                      </button>
                    }
                  />
                </div>
              ) : null}
              <div className="mt-4">
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Search vendors..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={handleKeyDown}
                  type="search"
                />
              </div>
            </div>

            <div className="flex-1 min-h-[280px]">
              {filteredVendors.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title="No vendors yet"
                    body="Create your first vendor profile to get started."
                  />
                </div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto rounded-2xl border divide-y">
                  {filteredVendors.map((vendor) => {
                    const isBest = vendor.id === bestMatchId;
                    return (
                      <button
                        key={vendor.id}
                        ref={(node) => {
                          rowRefs.current[vendor.id] = node;
                        }}
                        type="button"
                        onClick={() => router.push(`/secure-access/${vendor.id}`)}
                        className={`w-full text-left p-4 transition ${
                          isBest ? "bg-black/5" : "hover:bg-black/5"
                        }`}
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <div className="font-semibold">{vendor.name}</div>
                            <div className="text-xs opacity-70">
                              {getWebsiteDomain(vendor.website)}
                            </div>
                            <div className="text-xs opacity-70">{vendor.contactEmail}</div>
                          </div>
                          <div className="text-xs opacity-60">
                            Updated by {vendor.lastUpdatedBy}
                          </div>
                        </div>
                        <div className="mt-2 text-xs underline opacity-70">View profile</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
