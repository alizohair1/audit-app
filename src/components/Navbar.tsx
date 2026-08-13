"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Navbar({
  title,
  fullName,
}: {
  title: string;
  fullName?: string | null;
}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="clay-nav">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-grey">Internal Audit</p>
          <h1 className="text-lg font-bold text-ink">{title}</h1>
        </div>
        <div className="flex items-center gap-4">
          {fullName && <span className="text-sm text-grey hidden sm:inline">{fullName}</span>}
          <button onClick={handleLogout} className="btn btn-secondary text-sm">
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
