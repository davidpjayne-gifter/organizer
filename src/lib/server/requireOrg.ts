import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

  const { data: settings, error } = await supabase
    .from("user_settings")
    .select("active_organization_id")
    .eq("user_id", user.id)
    .single();

  if (error || !settings?.active_organization_id) {
    redirect("/onboarding");
  }

  return {
    supabase,
    user,
    activeOrgId: settings.active_organization_id as string,
  };
}
