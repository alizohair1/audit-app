import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, std_score } = (await req.json()) as { id: string; std_score: number | null };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("job_types").update({ std_score }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
