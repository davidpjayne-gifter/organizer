"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const userEmail = data.user?.email;

      if (!userEmail) {
        router.replace("/login");
        return;
      }

      setEmail(userEmail);
      setLoading(false);
    })();
  }, [router, supabase]);

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <main className="min-h-screen p-6 flex flex-col">
      <div className="space-y-6">
        {/* Message board */}
        <section className="rounded-2xl border p-4 text-center">
          <div className="font-semibold">Message Board</div>
          <div className="text-sm opacity-80 mt-1">
            Welcome back, {email}. (Announcements will live here.)
          </div>
        </section>

        {/* Profiles at a glance */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-4 text-center">
            <div className="font-semibold">My Access</div>
            <div className="text-sm opacity-80 mt-1">Role: Admin (mock)</div>
          </div>
          <div className="rounded-2xl border p-4 text-center">
            <div className="font-semibold">My Profile</div>
            <div className="text-sm opacity-80 mt-1">Organization: ORGanizer (mock)</div>
          </div>
          <div className="rounded-2xl border p-4 text-center">
            <div className="font-semibold">Recent</div>
            <div className="text-sm opacity-80 mt-1">No recent activity (mock)</div>
          </div>
        </section>

        {/* Payroll Change Tracker big tile */}
        <button className="w-full rounded-2xl border p-10 text-center hover:bg-black/5">
          <div className="text-xl font-semibold">Payroll Change Tracker</div>
          <div className="text-sm opacity-80 mt-2">
            Only payroll changes show here (mock list for now).
          </div>
          <ul className="mt-4 text-sm space-y-1 opacity-90">
            <li>Adjusted hourly rate — by David — Jan 7</li>
            <li>Added stipend — by Admin — Jan 6</li>
          </ul>
        </button>

        {/* Secure Access Notes (centered, half width) */}
        <button
          className="mx-auto w-full md:w-1/2 rounded-2xl border p-6 text-center hover:bg-black/5"
          onClick={() => router.push("/secure-access")}
        >
          <div className="text-lg font-semibold">Secure Access Notes</div>
          <div className="text-sm opacity-80 mt-2">
            Vendor profiles, access details, and handoff notes.
          </div>
        </button>
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
