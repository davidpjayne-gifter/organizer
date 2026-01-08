import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { NativeMessage } from "@/components/ui/NativeMessage";
import { AcceptInviteClient } from "./AcceptInviteClient";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token?.trim() ?? "";

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <NativeMessage
            title="Invalid invite link"
            body="This invite link is missing or malformed."
            tone="warning"
            actions={
              <Link className="btn btn-sm" href="/login">
                Go to login
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const redirectUrl = `/invite?token=${encodeURIComponent(token)}`;
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <NativeMessage
            title="Please sign in to accept your invite"
            body="Use the same email address that received the invite."
            tone="info"
            actions={
              <Link className="btn btn-primary w-full" href={`/login?redirect=${redirectUrl}`}>
                Sign in
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Accept invite</h1>
          <p className="text-sm opacity-80 mt-1">
            Click below to join this organization.
          </p>
        </div>
        <AcceptInviteClient token={token} />
      </div>
    </main>
  );
}
