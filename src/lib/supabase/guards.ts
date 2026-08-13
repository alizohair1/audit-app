import { createClient } from "./server";
import type { Profile } from "@/types/database.types";

/** Returns the caller's profile, or null if not logged in. */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (profile as Profile) ?? null;
}

/** Throws-style guard for API routes: returns profile if admin, otherwise null. */
export async function requireAdmin(): Promise<Profile | null> {
  const profile = await getMyProfile();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}
