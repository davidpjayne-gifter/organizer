import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentOrgId } from "@/lib/org";
import { NativeMessage } from "@/components/ui/NativeMessage";
import { setCurrentOrg } from "./actions";

export default async function AccessPage() {
  const currentOrgId = await getCurrentOrgId();
  if (currentOrgId) {
    redirect("/dashboard");
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
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", user.id);

  let orgIds = memberships?.map((item) => item.org_id) ?? [];

  if (orgIds.length === 0) {
    const { data: legacy } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id);
    orgIds = legacy?.map((item) => item.organization_id as string) ?? [];
  }

  if (orgIds.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <NativeMessage
            title="No organization access"
            body="You don’t have access to an organization yet. Ask an admin to invite you."
            tone="warning"
          />
        </div>
      </main>
    );
  }

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .in("id", orgIds);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Choose an organization</h1>
          <p className="text-sm opacity-80 mt-1">
            Select the organization you want to access.
          </p>
        </div>

        <form action={setCurrentOrg} className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide opacity-70">Organization</label>
            <select name="org_id" className="w-full rounded-xl border px-3 py-2" required>
              <option value="">Select an organization</option>
              {orgs?.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary w-full" type="submit">
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
