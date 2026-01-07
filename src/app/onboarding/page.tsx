"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { createOrg, ensureUserHasOrgOrNull } from "@/lib/org/store";
import { NativeMessage } from "@/components/ui/NativeMessage";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [orgName, setOrgName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ id?: string | null; email?: string | null } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const currentUser = data.user ?? null;
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser({ id: currentUser.id, email: currentUser.email });
      const { selectedOrgId, orgs } = ensureUserHasOrgOrNull(currentUser);
      if (selectedOrgId || orgs.length > 0) {
        router.replace("/dashboard");
      }
    })();
  }, [router, supabase]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

    const name = orgName.trim();
    if (name.length < 2) {
      setError("Organization name must be at least 2 characters.");
      return;
    }

    setError("");
    setStatus("loading");
    createOrg({ name }, user);
    router.replace("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Create Organization</h1>
          <p className="text-sm opacity-80 mt-1">
            Set up your organization to access ORGanizer tools.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide opacity-70">
              Organization name
            </label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="ORGanizer HQ"
              value={orgName}
              onChange={(event) => setOrgName(event.target.value)}
              required
              minLength={2}
              type="text"
            />
          </div>

          {error ? (
            <NativeMessage title="Organization name needed" body={error} tone="danger" />
          ) : null}

          <button className="btn btn-primary w-full" type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Creating…" : "Create Organization"}
          </button>
        </form>
      </div>
    </main>
  );
}
