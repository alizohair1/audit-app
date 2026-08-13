import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/supabase/guards";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { BRANCH_NAV } from "@/lib/nav";
import BranchEntryForm from "@/components/BranchEntryForm";
import type { BranchMeter } from "@/types/database.types";

export default async function BranchEntryPage() {
  const profile = await getMyProfile();
  if (!profile || profile.role !== "branch") redirect("/login");

  if (!profile.branch_id) {
    return (
      <div>
        <Navbar title="Branch" fullName={profile.full_name} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="card p-6 text-sm text-grey">
            Your account isn't linked to a branch yet. Ask an admin to assign your branch.
          </div>
        </main>
      </div>
    );
  }

  const supabase = createClient();

  const { data: branch } = await supabase
    .from("branches")
    .select("*")
    .eq("id", profile.branch_id)
    .single();

  const { data: meters } = await supabase
    .from("branch_meters")
    .select("*")
    .eq("branch_id", profile.branch_id)
    .order("meter_number");

  return (
    <div>
      <Navbar title={`Branch — ${branch?.name ?? ""}`} fullName={profile.full_name} />
      <SubNav items={BRANCH_NAV} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <BranchEntryForm
          branchId={profile.branch_id}
          userId={profile.id}
          meters={(meters as BranchMeter[]) ?? []}
        />
      </main>
    </div>
  );
}
