import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST(request: Request) {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim() ?? "";
  if (name.length < 2) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: memberships } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id);

  if (memberships && memberships.length > 0) {
    return NextResponse.json({ error: "Organization already exists." }, { status: 409 });
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name, created_by: user.id })
    .select("id")
    .single();

  if (orgErr || !org?.id) {
    console.error("org_create_failed", orgErr);
    return NextResponse.json({ error: "Unable to create organization." }, { status: 500 });
  }

  const { error: memberErr } = await admin.from("organization_members").insert({
    organization_id: org.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberErr) {
    console.error("member_create_failed", memberErr);
    return NextResponse.json({ error: "Unable to create organization." }, { status: 500 });
  }

  const { error: orgMemberErr } = await admin.from("org_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: "owner",
  });

  if (orgMemberErr) {
    console.error("org_member_create_failed", orgMemberErr);
    return NextResponse.json({ error: "Unable to create organization." }, { status: 500 });
  }

  const { error: settingsErr } = await admin.from("user_settings").upsert({
    user_id: user.id,
    active_organization_id: org.id,
  });

  if (settingsErr) {
    console.error("settings_update_failed", settingsErr);
    return NextResponse.json({ error: "Unable to create organization." }, { status: 500 });
  }

  return NextResponse.json({ id: org.id });
}
