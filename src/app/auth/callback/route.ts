import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  let exchangeSession = null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login?error=auth_callback", url));
    }
    exchangeSession = data.session;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const activeSession = exchangeSession ?? session;
  const authedSupabase = activeSession?.access_token
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${activeSession.access_token}` } },
      })
    : supabase;

  const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

  const writeClient = adminSupabase ?? authedSupabase;

  const {
    data: { user },
  } = await authedSupabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", url));
  }

  await writeClient
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? "",
        full_name: (user.user_metadata?.full_name as string) ?? null,
      },
      { onConflict: "id" }
    );

  const { data: memberships } = await writeClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    return NextResponse.redirect(new URL("/onboarding", url));
  } else {
    const { data: settings } = await writeClient
      .from("user_settings")
      .select("active_organization_id")
      .eq("user_id", user.id)
      .single();

    if (!settings?.active_organization_id) {
      await writeClient.from("user_settings").upsert({
        user_id: user.id,
        active_organization_id: memberships[0].organization_id,
      });
    }
  }

  return NextResponse.redirect(new URL("/dashboard", url));
}
