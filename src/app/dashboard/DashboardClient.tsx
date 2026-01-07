"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { loadPayrollState, PayrollChangeLog } from "@/lib/payroll/store";

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
}

export default function DashboardClient({ orgId, orgName, email }: DashboardClientProps) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [payrollLogs, setPayrollLogs] = useState<PayrollChangeLog[]>([]);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoError, setLogoError] = useState<string>("");
  const [exportRange, setExportRange] = useState("7");
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [exportNotice, setExportNotice] = useState("");

  useEffect(() => {
    const payrollState = loadPayrollState();
    const logs = payrollState.payrollChangeLogByOrgId[orgId] ?? [];
    setPayrollLogs(logs.slice(0, 10));
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const stored = window.localStorage.getItem(`organizer_org_logo_${orgId}`);
    if (stored) {
      setLogoUrl(stored);
    }
  }, [orgId]);

  const headerTitle = useMemo(() => {
    if (!orgName) return "ORGanizer";
    return `ORGanizer: ${orgName}`;
  }, [orgName]);

  function exportPayrollChanges(days: number) {
    setExportNotice("");
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const allLogs = loadPayrollState().payrollChangeLogByOrgId[orgId] ?? [];
    const filtered = allLogs.filter((log) => new Date(log.createdAt).getTime() >= cutoff);
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
      ["Employee", "Fields Changed", "Actor", "Timestamp"].join(","),
      ...filtered.map((log) =>
        [
          `"${log.employeeName}"`,
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
    link.download = `payroll-changes-${days}d.csv`;
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

  return (
    <main className="min-h-screen p-6 flex flex-col">
      <div className="space-y-6">
        <header className="relative flex flex-col gap-4 sm:min-h-[132px]">
          <div className="text-center">
            <div className="text-2xl font-semibold">{headerTitle}</div>
            <div className="text-sm opacity-70 mt-1">Scoped to {orgName}</div>
          </div>
          <div className="rounded-2xl border p-4 text-center space-y-3 sm:w-64 sm:absolute sm:right-0 sm:top-0">
            <div className="font-semibold">Organization Logo</div>
            {logoUrl ? (
              <div className="flex justify-center">
                <img
                  src={logoUrl}
                  alt={`${orgName} logo`}
                  className="h-20 w-20 rounded-2xl border object-cover"
                />
              </div>
            ) : (
              <div className="text-sm opacity-70">Upload a logo for your organization.</div>
            )}
            {logoError ? <div className="text-sm text-red-600">{logoError}</div> : null}
            <input
              className="mx-auto block text-sm"
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
            />
          </div>
        </header>

        <section className="rounded-2xl border p-4 text-center">
          <div className="font-semibold">Message Board</div>
          <div className="text-sm opacity-80 mt-1">
            Welcome back, {email}. (Announcements will live here.)
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border p-2 text-center">
            <div className="font-semibold">My Access</div>
            <div className="text-xs opacity-80 mt-1">Role: Admin (mock)</div>
          </div>
          <div className="rounded-2xl border p-2 text-center">
            <div className="font-semibold">My Profile</div>
            <div className="text-xs opacity-80 mt-1">Organization: ORGanizer (mock)</div>
          </div>
          <div className="rounded-2xl border p-2 text-center">
            <div className="font-semibold">Recent</div>
            <div className="text-xs opacity-80 mt-1">No recent activity (mock)</div>
          </div>
        </section>

        <button
          className="w-full rounded-2xl border p-8 text-center hover:bg-black/5"
          onClick={() => router.push("/payroll")}
        >
          <div className="text-xl font-semibold">Payroll</div>
          <div className="text-sm opacity-80 mt-2">
            Review employee payroll profiles and track changes.
          </div>
          <div className="text-xs opacity-60 mt-2">Scoped to {orgName}</div>
        </button>

        <button
          className="mx-auto w-full md:w-1/2 rounded-2xl border p-6 text-center hover:bg-black/5"
          onClick={() => router.push("/secure-access")}
        >
          <div className="text-lg font-semibold">Secure Access Notes</div>
          <div className="text-sm opacity-80 mt-2">
            Vendor profiles, access details, and handoff notes.
          </div>
          <div className="text-xs opacity-60 mt-2">Scoped to {orgName}</div>
        </button>

        <section className="rounded-2xl border p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Payroll Change Tracker</div>
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
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
            <button
              className="rounded-xl border px-4 py-2 text-sm opacity-80 hover:opacity-100"
              onClick={() => exportPayrollChanges(Number(exportRange))}
            >
              Export
            </button>
          </div>
          {exportNotice ? <div className="text-xs opacity-70">{exportNotice}</div> : null}
          {payrollLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm opacity-70 text-center">
              No payroll changes yet.
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {payrollLogs.map((log) => {
                const fieldsSummary = log.fieldsChanged.length
                  ? log.fieldsChanged.join(", ")
                  : log.summary;
                return (
                  <li key={log.id} className="rounded-2xl border px-4 py-3">
                    <div className="font-medium">{log.employeeName}</div>
                    <div className="text-xs opacity-70">
                      {fieldsSummary} · by {log.actorName} · {timeAgo(log.createdAt)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

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
