"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email for your login link.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="text-sm opacity-80 mt-1">We’ll email you a secure link to sign in.</p>

        <form onSubmit={sendLink} className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border px-3 py-2"
            placeholder="you@organization.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <button
            className="w-full rounded-xl border px-3 py-2 font-medium hover:bg-black/5 disabled:opacity-50"
            disabled={status === "sending"}
            type="submit"
          >
            {status === "sending" ? "Sending…" : "Send login link"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm">{message}</p> : null}

        {status === "sent" ? (
          <p className="mt-2 text-xs opacity-70">You can close this tab after you click the email link.</p>
        ) : null}
      </div>
    </main>
  );
}
