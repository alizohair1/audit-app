import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const adminClient = createAdminClient();

  const { data: profiles, error } = await adminClient
    .from("profiles")
    .select("*, branch:branches(id, name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with email from auth.users (not stored in profiles)
  const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(authUsers?.users.map((u) => [u.id, u.email]));

  const enriched = profiles?.map((p) => ({ ...p, email: emailById.get(p.id) ?? null }));

  return NextResponse.json({ users: enriched });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { email, password, full_name, role, branch_id } = body as {
    email: string;
    password: string;
    full_name: string;
    role: "admin" | "auditor" | "branch";
    branch_id?: string | null;
  };

  if (!email || !password || !role) {
    return NextResponse.json({ error: "email, password, and role are required" }, { status: 400 });
  }
  if (role === "branch" && !branch_id) {
    return NextResponse.json({ error: "branch_id is required for branch users" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message ?? "Failed to create user" }, { status: 500 });
  }

  // The DB trigger auto-creates a profile row with role='branch'; now set the real role/branch/name.
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ full_name, role, branch_id: role === "branch" ? branch_id : null })
    .eq("id", created.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: created.user.id });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { id, full_name, role, branch_id } = body as {
    id: string;
    full_name?: string;
    role?: "admin" | "auditor" | "branch";
    branch_id?: string | null;
  };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({
      ...(full_name !== undefined ? { full_name } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(branch_id !== undefined ? { branch_id: role === "branch" ? branch_id : null } : {}),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = (await req.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
