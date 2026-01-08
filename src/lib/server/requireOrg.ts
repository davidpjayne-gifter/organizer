import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getCurrentOrgId, getOrgRole } from "@/lib/org";

export async function requireUserAndActiveOrg() {
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

  const activeOrgId = await getCurrentOrgId();
  if (!activeOrgId) {
    redirect("/access");
  }

  const role = await getOrgRole(activeOrgId);
  if (!role) {
    redirect("/access");
  }

  await supabase.from("user_settings").upsert({
    user_id: user.id,
    active_organization_id: activeOrgId,
  });

  return {
    supabase,
    user,
    activeOrgId: activeOrgId as string,
  };
}
