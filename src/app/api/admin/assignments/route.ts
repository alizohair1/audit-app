import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/** Replaces an auditor's branch assignments with exactly the given set (supports "select all"). */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { auditor_id, branch_ids } = (await req.json()) as { auditor_id: string; branch_ids: string[] };
  if (!auditor_id || !Array.isArray(branch_ids)) {
    return NextResponse.json({ error: "auditor_id and branch_ids[] are required" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { error: deleteError } = await adminClient
    .from("auditor_branch_assignments")
    .delete()
    .eq("auditor_id", auditor_id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (branch_ids.length > 0) {
    const rows = branch_ids.map((branch_id) => ({ auditor_id, branch_id }));
    const { error: insertError } = await adminClient.from("auditor_branch_assignments").insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = (await req.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("auditor_branch_assignments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
