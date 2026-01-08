"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  deleteVendor,
  getWebsiteDomain,
  loadState,
  logVendorEvent,
  updateVendor,
  Vendor,
  VendorActivityEvent,
} from "@/lib/secure-access/store";
import { EmptyState } from "@/components/ui/EmptyState";
import { NativeMessage } from "@/components/ui/NativeMessage";

const maskPassword = (value: string) => "•".repeat(Math.max(value.length, 6));

const timeAgo = (iso: string) => {
  const delta = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(delta)) return "";
  const minutes = Math.floor(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

export default function SecureAccessVendorClient() {
  const params = useParams();
  const vendorId = params.vendorId as string;
  const router = useRouter();

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [activity, setActivity] = useState<VendorActivityEvent[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    website: "",
    accountNumber: "",
    contactPhone: "",
    contactEmail: "",
    password: "",
  });

  useEffect(() => {
    const state = loadState();
    const found = state.vendors.find((item) => item.id === vendorId) ?? null;
    if (!found) {
      setNotFound(true);
      setVendor(null);
      return;
    }

    setNotFound(false);
    setVendor(found);
    setForm({
      name: found.name,
      website: found.website,
      accountNumber: found.accountNumber,
      contactPhone: found.contactPhone,
      contactEmail: found.contactEmail,
      password: found.password,
    });
    setActivity(state.activityByVendorId[vendorId] ?? []);
  }, [vendorId]);

  useEffect(() => {
    if (!copyStatus) return;
    const timeout = setTimeout(() => setCopyStatus(""), 2000);
    return () => clearTimeout(timeout);
  }, [copyStatus]);

  const activityList = useMemo(() => activity, [activity]);

  if (notFound) {
    return (
      <main className="min-h-screen p-6">
        <div className="max-w-xl">
          <NativeMessage
            title="Vendor not found"
            body="We couldn’t locate that vendor profile."
            tone="warning"
            actions={
              <Link className="btn btn-sm" href="/secure-access">
                Back to Secure Access Notes
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  if (!vendor) {
    return (
      <div className="p-6">
        <NativeMessage title="Loading vendor" body="Fetching vendor profile details." />
      </div>
    );
  }

  function refresh() {
    const state = loadState();
    const updated = state.vendors.find((item) => item.id === vendorId) ?? null;
    setVendor(updated);
    setActivity(state.activityByVendorId[vendorId] ?? []);
  }

  function handleToggleReveal() {
    const next = !showPassword;
    setShowPassword(next);
    if (next) {
      logVendorEvent(vendorId, {
        action: "Password revealed",
        actorName: "Admin",
      });
      refresh();
    }
  }

  async function handleCopy() {
    if (!vendor) return;
    try {
      await navigator.clipboard.writeText(vendor.password);
      setCopyStatus("Copied");
      logVendorEvent(vendorId, {
        action: "Password copied",
        actorName: "Admin",
      });
      refresh();
    } catch {
      setCopyStatus("Copy failed");
    }
  }

  function handleSave() {
    if (!vendor) return;
    const changes: string[] = [];
    const patch: Partial<Vendor> = {};

    if (form.name.trim() !== vendor.name) {
      patch.name = form.name.trim();
      changes.push("Vendor Name");
    }
    if (form.website.trim() !== vendor.website) {
      patch.website = form.website.trim();
      changes.push("Website");
    }
    if (form.accountNumber.trim() !== vendor.accountNumber) {
      patch.accountNumber = form.accountNumber.trim();
      changes.push("Account Number");
    }
    if (form.contactPhone.trim() !== vendor.contactPhone) {
      patch.contactPhone = form.contactPhone.trim();
      changes.push("Contact Phone");
    }
    if (form.contactEmail.trim() !== vendor.contactEmail) {
      patch.contactEmail = form.contactEmail.trim();
      changes.push("Contact Email");
    }
    if (form.password !== vendor.password) {
      patch.password = form.password;
      changes.push("Password updated");
    }

    if (changes.length === 0) {
      setEditing(false);
      return;
    }

    updateVendor(vendorId, patch, "Admin");
    logVendorEvent(vendorId, {
      action: "Vendor updated",
      actorName: "Admin",
      fieldsChanged: changes,
    });
    refresh();
    setEditing(false);
  }

  function handleCancel() {
    if (!vendor) return;
    setEditing(false);
    setForm({
      name: vendor.name,
      website: vendor.website,
      accountNumber: vendor.accountNumber,
      contactPhone: vendor.contactPhone,
      contactEmail: vendor.contactEmail,
      password: vendor.password,
    });
  }

  function handleDeleteVendor() {
    if (!vendor) return;
    deleteVendor(vendorId);
    logVendorEvent(vendorId, {
      action: "Vendor deleted",
      actorName: "Admin",
    });
    router.push("/secure-access");
  }

  return (
    <main className="min-h-screen p-6">
      <div className="space-y-6">
        <header className="space-y-2">
          <Link className="text-sm underline opacity-80 hover:opacity-100" href="/secure-access">
            Back to Secure Access Notes
          </Link>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{vendor.name}</h1>
              <a
                className="text-sm underline"
                href={vendor.website}
                target="_blank"
                rel="noreferrer"
              >
                {getWebsiteDomain(vendor.website)}
              </a>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full border px-3 py-1">Vendor</span>
              <span className="rounded-full border px-3 py-1">Secure Access Notes</span>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">Vendor Details</div>
            <button
              className="btn btn-blue btn-sm"
              type="button"
              onClick={() => setEditing((prev) => !prev)}
            >
              {editing ? "Editing" : "Edit"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide opacity-60">Vendor Name</div>
              {editing ? (
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              ) : (
                <div>{vendor.name}</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide opacity-60">Website</div>
              {editing ? (
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={form.website}
                  onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
                />
              ) : (
                <a
                  className="text-sm underline"
                  href={vendor.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  {vendor.website}
                </a>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide opacity-60">Account Number</div>
              {editing ? (
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={form.accountNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
                />
              ) : (
                <div>{vendor.accountNumber}</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide opacity-60">Contact Phone</div>
              {editing ? (
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={form.contactPhone}
                  onChange={(event) => setForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
                />
              ) : (
                <div>{vendor.contactPhone}</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide opacity-60">Contact Email</div>
              {editing ? (
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  value={form.contactEmail}
                  onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                />
              ) : (
                <div>{vendor.contactEmail}</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide opacity-60">Password</div>
              {editing ? (
                <input
                  className="w-full rounded-xl border px-3 py-2"
                  type="text"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span>{showPassword ? vendor.password : maskPassword(vendor.password)}</span>
                  <button
                    className="text-xs underline opacity-80"
                    type="button"
                    onClick={handleToggleReveal}
                  >
                    {showPassword ? "Hide" : "Reveal"}
                  </button>
                  <button
                    className="text-xs underline opacity-80"
                    type="button"
                    onClick={handleCopy}
                  >
                    Copy
                  </button>
                  {copyStatus ? <span className="text-xs opacity-60">{copyStatus}</span> : null}
                </div>
              )}
            </div>
          </div>

          {editing ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                className="btn btn-primary w-full"
                type="button"
                onClick={handleSave}
              >
                Save changes
              </button>
              <button
                className="btn w-full"
                type="button"
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          ) : null}
          {editing ? (
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide opacity-60">Delete vendor</label>
              <div className="flex justify-end">
                <button
                  className="btn btn-sm border-red-200 bg-red-50 text-red-700"
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete
                </button>
              </div>
              {showDeleteConfirm ? (
                <div className="text-center">
                  <NativeMessage
                    title="Are you sure?"
                    body={`Delete ${vendor.name} from the database?`}
                    tone="warning"
                    actions={
                      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                        <button
                          className="btn btn-sm border-red-200 bg-red-50 text-red-700"
                          type="button"
                          onClick={handleDeleteVendor}
                        >
                          Yes, delete
                        </button>
                        <button
                          className="btn btn-sm"
                          type="button"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border p-6 space-y-4">
          <div className="text-lg font-semibold">Vendor Activity</div>
          {activityList.length === 0 ? (
            <EmptyState title="No activity yet" body="Vendor updates will appear here." />
          ) : (
            <div className="max-h-[360px] overflow-y-auto space-y-3">
              {activityList.map((event) => (
                <div key={event.id} className="rounded-2xl border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">{event.action}</div>
                      <div className="text-xs opacity-70">
                        {event.actorName} ·{" "}
                        <span title={new Date(event.createdAt).toLocaleString()}>
                          {timeAgo(event.createdAt)}
                        </span>
                      </div>
                    </div>
                    {event.fieldsChanged && event.fieldsChanged.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {event.fieldsChanged.map((field) => (
                          <span
                            key={field}
                            className="rounded-full border px-3 py-1 text-xs opacity-70"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {event.note ? <div className="text-xs opacity-70 mt-2">{event.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
