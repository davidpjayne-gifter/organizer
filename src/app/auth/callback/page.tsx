"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  useEffect(() => {
    // With implicit flow, tokens come back in the URL hash.
    // supabase-js will read it and persist the session automatically.
    // We just need to wait a tick, then send the user onward.
    (async () => {
      await supabase.auth.getSession();
      router.replace("/dashboard");
    })();
  }, [router, supabase]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="rounded-2xl border p-6">
        <div className="text-lg font-semibold">Signing you in…</div>
        <div className="text-sm opacity-80 mt-1">One moment.</div>
      </div>
    </main>
  );
}
