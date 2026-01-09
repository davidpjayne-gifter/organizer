"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { PayrollChangeLog } from "@/lib/payroll/store";
import { fetchPayrollLogs, fetchPayrollLogsSince } from "@/lib/payroll/supabase";
import { EmptyState } from "@/components/ui/EmptyState";
import { NativeMessage } from "@/components/ui/NativeMessage";
import { InviteFormClient } from "@/app/settings/members/InviteFormClient";
import { ReinviteButton } from "@/app/settings/members/ReinviteButton";

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

interface DashboardClientProps {
  orgId: string;
  orgName: string;
  email: string;
  members: Array<{ user_id: string; role: string; created_at: string }>;
  invites: Array<{
    id: string;
    email: string;
    role: string;
    created_at: string;
    expires_at: string | null;
  }>;
  isOrgAdmin: boolean;
}

export default function DashboardClient({
  orgId,
  orgName,
  email,
  members,
  invites,
  isOrgAdmin,
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [payrollLogs, setPayrollLogs] = useState<PayrollChangeLog[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoError, setLogoError] = useState<string>("");
  const [exportRange, setExportRange] = useState("7");
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exportNotice, setExportNotice] = useState("");
  const [messages, setMessages] = useState<{ id: string; text: string; createdAt: string }[]>(
    []
  );
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadLogs() {
      const logs = await fetchPayrollLogs(supabase, orgId, 10);
      if (!isMounted) return;
      setPayrollLogs(logs);
    }
    if (orgId) {
      loadLogs().catch((error) => {
        console.error(error);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [orgId, supabase]);

  useEffect(() => {
    if (!orgId) return;
    const stored = window.localStorage.getItem(`organizer_org_logo_${orgId}`);
    if (stored) {
      setLogoUrl(stored);
    }
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const stored = window.localStorage.getItem(`organizer_org_messages_${orgId}`);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { id: string; text: string; createdAt: string }[];
      setMessages(parsed);
    } catch {
      setMessages([]);
    }
  }, [orgId]);

  const headerTitle = useMemo(() => {
    if (!orgName) return "ORGanizer";
    return `ORGanizer: ${orgName}`;
  }, [orgName]);

  async function exportPayrollChanges(days: number) {
    setExportNotice("");
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const sinceIso = new Date(cutoff).toISOString();
    const filtered = await fetchPayrollLogsSince(supabase, orgId, sinceIso);
    if (filtered.length === 0) {
      setExportNotice("No changes in the selected range.");
      return;
    }

    if (exportFormat === "pdf") {
      const rows = filtered
        .map(
          (log) =>
            `<tr><td>${log.employeeName}</td><td>${log.fieldsChanged.join(
              ", "
            )}</td><td>${log.actorName}</td><td>${log.createdAt}</td></tr>`
        )
        .join("");

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payroll Change Tracker</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h1 { font-size: 18px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
      th { background: #f5f5f5; }
    </style>
  </head>
  <body>
    <h1>Payroll Change Tracker (${orgName})</h1>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Fields Changed</th>
          <th>Actor</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`;

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        setExportNotice("Pop-up blocked. Allow pop-ups to export PDF.");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }

    const rows = [
      ["Employee", "Note (Updated)", "Note (Previous)", "Fields Changed", "Actor", "Timestamp"].join(
        ","
      ),
      ...filtered.map((log) =>
        [
          `"${log.employeeName}"`,
          `"${log.noteAfter ?? ""}"`,
          `"${log.noteBefore ?? ""}"`,
          `"${log.fieldsChanged.join("; ")}"`,
          `"${log.actorName}"`,
          `"${log.createdAt}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-changes-${days}d-excel.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogoError("");
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) return;
      const img = new Image();
      img.onload = () => {
        const isSquare = img.width === img.height;
        const withinLimit = img.width <= 3000 && img.height <= 3000;
        if (!isSquare) {
          setLogoError("Logo must be a square image.");
          return;
        }
        if (!withinLimit) {
          setLogoError("Logo must be 3000 x 3000 px or smaller.");
          return;
        }
        setLogoUrl(result);
        window.localStorage.setItem(`organizer_org_logo_${orgId}`, result);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  }

  function addMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: trimmed,
        createdAt: new Date().toISOString(),
      },
      ...messages,
    ];
    setMessages(next);
    window.localStorage.setItem(`organizer_org_messages_${orgId}`, JSON.stringify(next));
  }

  return (
    <main className="min-h-screen p-6 flex flex-col">
      <div className="space-y-6">
        <header className="relative flex flex-col gap-4 sm:min-h-[132px]">
          <div className="text-center space-y-0">
            <div className="text-2xl font-semibold">{headerTitle}</div>
            <div className="mt-0 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <div className="text-center">
                <div className="font-semibold">My Access</div>
                <div className="text-xs opacity-80 mt-1">Role: Admin</div>
              </div>
            </div>
            <div className="text-sm opacity-80 mt-1">My Profile: {email}</div>
          </div>
          <div className="sm:w-64 sm:absolute sm:right-0 sm:top-0">
            {logoUrl ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={logoUrl}
                  alt={`${orgName} logo`}
                  className="h-20 w-20 rounded-xl border object-cover"
                />
                <button
                  className="text-xs text-slate-600 underline"
                  type="button"
                  aria-label="Replace organization logo"
                  onClick={() => logoInputRef.current?.click()}
                >
                  Replace
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-4 text-center space-y-2">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl border border-dashed text-xs opacity-60">
                  Logo
                </div>
                <div className="font-semibold">Add your logo</div>
                <div className="text-xs opacity-70">Shown on your dashboard and exports.</div>
                <button
                  className="btn btn-sm w-full"
                  type="button"
                  aria-label="Add organization logo"
                  onClick={() => logoInputRef.current?.click()}
                >
                  Add logo
                </button>
              </div>
            )}
            {logoError ? <div className="text-sm text-red-600 mt-2">{logoError}</div> : null}
            <input
              ref={logoInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
            />
          </div>
        </header>

        <section className="mx-auto w-full max-w-2xl border border-black p-4 text-center space-y-3 bg-[#D6AF7C] shadow-[0_10px_30px_rgba(14,30,74,0.08)]">
          <div className="flex flex-col items-center gap-2">
            <div className="font-semibold">Message Board</div>
            <button
              className="btn btn-sm border-emerald-200 bg-emerald-50 text-emerald-700"
              type="button"
              onClick={() => setShowMessageForm(true)}
            >
              Add message
            </button>
          </div>
          <div className="text-sm opacity-80">
            Welcome back, {email}. Share quick updates with your ORG.
          </div>
          {showMessageForm ? (
            <NativeMessage
              title="New announcement"
              body="Write a short update for your team."
              actions={
                <div className="flex w-full flex-col gap-2">
                  <textarea
                    className="w-full border bg-white px-3 py-2 text-sm"
                    rows={3}
                    value={messageDraft}
                    onChange={(event) => setMessageDraft(event.target.value)}
                    placeholder="Add a message for your ORG..."
                  />
                  <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
                    <button
                      className="btn btn-sm border-emerald-200 bg-emerald-50 text-emerald-700"
                      type="button"
                      onClick={() => {
                        addMessage(messageDraft);
                        setMessageDraft("");
                        setShowMessageForm(false);
                      }}
                    >
                      Post message
                    </button>
                    <button
                      className="btn btn-sm"
                      type="button"
                      onClick={() => {
                        setMessageDraft("");
                        setShowMessageForm(false);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              }
            />
          ) : null}
          {messages.length === 0 ? (
            <EmptyState title="No messages yet" body="Add the first update for your ORG." />
          ) : (
            <div className="max-h-[240px] overflow-y-auto pr-1">
              <ul className="space-y-2 text-center">
                {messages.map((message) => (
                  <li
                    key={message.id}
                    className="border bg-white px-4 py-3 text-sm text-center shadow-[0_6px_16px_rgba(14,30,74,0.08)]"
                  >
                    <div className="font-medium">{messages.length > 0 ? message.text : ""}</div>
                    <div className="text-xs opacity-60 mt-1">{timeAgo(message.createdAt)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <button
          className="w-full rounded-2xl border p-8 text-center hover:bg-black/5"
          onClick={() => router.push("/payroll")}
        >
          <div className="text-xl font-semibold">Payroll</div>
          <div className="text-sm opacity-80 mt-2">
            Review employee payroll profiles and track changes.
          </div>
        </button>

        <div className="flex justify-center">
          <button
            className="w-full md:w-1/2 rounded-2xl border p-6 text-center hover:bg-black/5"
            onClick={() => router.push("/secure-access")}
          >
            <div className="text-lg font-semibold">Secure Access Notes</div>
            <div className="text-sm opacity-80 mt-2">
              Vendor profiles, access details, and handoff notes.
            </div>
          </button>
        </div>

        <section className="rounded-2xl border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Upcoming Payroll Changes</div>
              <div className="text-sm opacity-80">Recent changes for {orgName}.</div>
            </div>
            <button
              className="text-sm underline opacity-80 hover:opacity-100"
              onClick={() => router.push("/payroll")}
            >
              View all
            </button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-wide opacity-70">Export range</label>
              <select
                className="rounded-xl border px-2 py-1 text-sm"
                value={exportRange}
                onChange={(event) => setExportRange(event.target.value)}
              >
                <option value="1">Last day</option>
                <option value="7">Last week</option>
                <option value="14">Last 2 weeks</option>
                <option value="30">Last month</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-wide opacity-70">Format</label>
              <select
                className="rounded-xl border px-2 py-1 text-sm"
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as "csv" | "pdf")}
              >
                <option value="csv">Excel (CSV)</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <button
              className="btn btn-sm"
              onClick={() => void exportPayrollChanges(Number(exportRange))}
            >
              Export
            </button>
          </div>
          {exportNotice ? <div className="text-xs opacity-70">{exportNotice}</div> : null}
          {payrollLogs.length === 0 ? (
            <EmptyState title="No payroll changes yet" body="Recent updates will appear here." />
          ) : (
            <div className="max-h-[360px] overflow-y-auto pr-1">
              <ul className="space-y-2 text-sm">
                {payrollLogs.map((log) => {
                  const fieldsSummary = log.fieldsChanged.length
                    ? log.fieldsChanged.join(", ")
                    : log.summary;
                  const hasNoteChange = log.fieldsChanged.includes("Notes");
                return (
                  <li key={log.id} className="rounded-2xl border px-4 py-3">
                    <div className="font-medium">{log.employeeName}</div>
                    <div className="text-xs opacity-70">
                      {fieldsSummary} · by {log.actorName} · {timeAgo(log.createdAt)}
                    </div>
                    {hasNoteChange ? (
                      <div className="mt-3 text-xs opacity-70 space-y-1">
                        <div>
                          <span className="font-semibold">Updated note:</span>{" "}
                          {log.noteAfter?.trim() ? log.noteAfter : "—"}
                        </div>
                        <div>
                          <span className="font-semibold">Previous note:</span>{" "}
                          {log.noteBefore?.trim() ? log.noteBefore : "—"}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
              </ul>
            </div>
          )}
        </section>
      </div>

      {isOrgAdmin ? (
        <details className="rounded-2xl border p-6 mt-6">
          <summary className="text-lg font-semibold cursor-pointer list-none">
            Add users to {orgName}
          </summary>
          <div className="mt-4 space-y-6">
            <div className="text-sm opacity-80">
              Invite teammates and manage access for your organization.
            </div>

            <div className="rounded-2xl border p-4 space-y-4">
              <div className="font-semibold">Invite a member</div>
              <InviteFormClient />
            </div>

            <div className="rounded-2xl border p-4 space-y-4">
              <div className="font-semibold">Pending invites</div>
              {invites.length > 0 ? (
                <div className="space-y-3">
                  {invites.map((invite) => (
                    <div key={invite.id} className="rounded-2xl border px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-semibold">{invite.email}</div>
                          <div className="text-xs opacity-70">
                            Role: {invite.role} · Expires{" "}
                            {invite.expires_at
                              ? new Date(invite.expires_at).toLocaleString()
                              : "—"}
                          </div>
                        </div>
                        <ReinviteButton email={invite.email} role={invite.role} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No pending invites" body="All invites have been accepted." />
              )}
            </div>

            <div className="rounded-2xl border p-4 space-y-4">
              <div className="font-semibold">Members</div>
              {members.length > 0 ? (
                <ul className="space-y-3">
                  {members.map((member) => (
                    <li key={member.user_id} className="rounded-2xl border px-4 py-3">
                      <div className="font-semibold">{member.user_id}</div>
                      <div className="text-xs opacity-70">
                        Role: {member.role} · Added{" "}
                        {new Date(member.created_at).toLocaleDateString()}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No members yet" body="Invite someone to get started." />
              )}
            </div>
          </div>
        </details>
      ) : null}

      <button
        className="mt-auto mx-auto text-sm underline opacity-80 hover:opacity-100"
        onClick={async () => {
          await supabase.auth.signOut();
          router.push("/login");
        }}
      >
        Sign out
      </button>
    </main>
  );
}
