import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/supabase/guards";

export default async function Home() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "auditor") redirect("/auditor");
  if (profile.role === "utility_admin") redirect("/utility-admin");
  redirect("/branch");
}