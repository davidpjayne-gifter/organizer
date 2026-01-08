"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { NativeMessage } from "@/components/ui/NativeMessage";

export default function LoginClient() {
  const supabase = supabaseBrowser();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");

    const redirectPath = searchParams.get("redirect");
    const safeRedirect =
      redirectPath && redirectPath.startsWith("/") && !redirectPath.startsWith("//")
        ? redirectPath
        : null;
    const redirectQuery = safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : "";

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback${redirectQuery}`,
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
            placeholder="you@ORG.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <button className="btn btn-primary w-full" disabled={status === "sending"} type="submit">
            {status === "sending" ? "Sending…" : "Send login link"}
          </button>
        </form>

        {status === "error" ? (
          <div className="mt-4">
            <NativeMessage title="Login failed" body={message} tone="danger" />
          </div>
        ) : null}

        {status === "sent" ? (
          <div className="mt-4">
            <NativeMessage
              title="Check your email"
              body={`${message} You can close this tab after you click the email link.`}
              tone="success"
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
