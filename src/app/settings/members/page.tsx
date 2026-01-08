import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentOrgId, getOrgRole } from "@/lib/org";
import { InviteFormClient } from "./InviteFormClient";
import { ReinviteButton } from "./ReinviteButton";
import { TransferOwnershipClient } from "./TransferOwnershipClient";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function MembersSettingsPage() {
  const orgId = await getCurrentOrgId();
  if (!orgId) {
    redirect("/access");
  }

  const role = await getOrgRole(orgId);
  if (!role || !["admin", "owner"].includes(role)) {
    redirect("/access");
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookies().getAll(),
        setAll: () => {},
      },
    }
  );

  const { data: invites } = await supabase
    .from("org_invites")
    .select("id, email, role, created_at, expires_at, accepted_at, revoked_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const { data: members } = await supabase
    .from("org_members")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen p-6">
      <div className="space-y-6 max-w-4xl mx-auto">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm opacity-80">
            Invite teammates and manage access for this organization.
          </p>
        </header>

        <section className="rounded-2xl border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Invite a member</h2>
            <p className="text-sm opacity-80 mt-1">
              Send a secure invite link to join your organization.
            </p>
          </div>
          <InviteFormClient />
        </section>

        <section className="rounded-2xl border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Pending invites</h2>
            <p className="text-sm opacity-80 mt-1">
              Invites that haven’t been accepted yet.
            </p>
          </div>
          {invites && invites.length > 0 ? (
            <div className="space-y-3">
              {invites.map((invite) => (
                <div key={invite.id} className="rounded-2xl border px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold">{invite.email}</div>
                      <div className="text-xs opacity-70">
                        Role: {invite.role} · Expires {new Date(invite.expires_at).toLocaleString()}
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
        </section>

        <section className="rounded-2xl border p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Members</h2>
            <p className="text-sm opacity-80 mt-1">People who have access to this org.</p>
          </div>
          {members && members.length > 0 ? (
            <ul className="space-y-3">
              {members.map((member) => (
                <li key={member.user_id} className="rounded-2xl border px-4 py-3">
                  <div className="font-semibold">{member.user_id}</div>
                  <div className="text-xs opacity-70">
                    Role: {member.role} · Added {new Date(member.created_at).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No members yet" body="Invite someone to get started." />
          )}
        </section>

        {role === "owner" ? (
          <section className="rounded-2xl border p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
              <p className="text-sm opacity-80 mt-1">
                Sensitive actions that affect organization access.
              </p>
            </div>
            <div className="rounded-2xl border px-4 py-4 space-y-3">
              <div className="font-semibold">Transfer Ownership</div>
              <TransferOwnershipClient members={members ?? []} />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
