import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/supabase/guards";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { AUDITOR_NAV } from "@/lib/nav";
import AuditorJobBoard from "@/components/AuditorJobBoard";
import type { Branch, JobType } from "@/types/database.types";

export default async function AuditorJobsPage() {
  const profile = await getMyProfile();
  if (!profile || profile.role !== "auditor") redirect("/login");

  const supabase = createClient();

  const { data: assignments } = await supabase
    .from("auditor_branch_assignments")
    .select("branch:branches(id, name, code, created_at)")
    .eq("auditor_id", profile.id);

  const branches: Branch[] = (assignments ?? [])
    .map((a: any) => a.branch)
    .filter(Boolean)
    .sort((a: Branch, b: Branch) => a.name.localeCompare(b.name));

  const { data: jobTypes } = await supabase
    .from("job_types")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div>
      <Navbar title="Auditor" fullName={profile.full_name} />
      <SubNav items={AUDITOR_NAV} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {branches.length === 0 ? (
          <div className="card p-6 text-sm text-grey">
            You don't have any branches assigned yet. Ask an admin to assign you a branch.
          </div>
        ) : (
          <AuditorJobBoard
            auditorId={profile.id}
            branches={branches}
            jobTypes={(jobTypes as JobType[]) ?? []}
          />
        )}
      </main>
    </div>
  );
}
