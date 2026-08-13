"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import SubNav from "@/components/SubNav";
import { ADMIN_NAV } from "@/lib/nav";
import type { Branch, UserRole } from "@/types/database.types";

interface UserRow {
  id: string;
  full_name: string | null;
  role: UserRole;
  branch_id: string | null;
  email: string | null;
  branch?: { id: string; name: string } | null;
}

export default function AdminUsersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("auditor");
  const [branchId, setBranchId] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    const [{ data: branchData }, usersRes] = await Promise.all([
      supabase.from("branches").select("*").order("name"),
      fetch("/api/admin/users").then((r) => r.json()),
    ]);
    setBranches((branchData as Branch[]) ?? []);
    setUsers(usersRes.users ?? []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: fullName,
        role,
        branch_id: role === "branch" ? branchId : null,
      }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to create user");
      return;
    }
    setEmail("");
    setPassword("");
    setFullName("");
    loadAll();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this user? This cannot be undone.")) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) loadAll();
  }

  async function handleRoleChange(id: string, newRole: UserRole, currentBranch: string | null) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role: newRole, branch_id: currentBranch }),
    });
    loadAll();
  }

  return (
    <div>
      <Navbar title="Admin" />
      <SubNav items={ADMIN_NAV} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <h1 className="text-xl font-bold">Users</h1>

      <form onSubmit={handleCreate} className="card p-4 space-y-3">
        <h2 className="font-semibold">Add user</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="input" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Temporary password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            <option value="auditor">Auditor</option>
            <option value="branch">Branch</option>
            <option value="admin">Admin</option>
            <option value="utility_admin">Utility Admin</option>
          </select>
          {role === "branch" && (
            <select className="input" value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {error && <p className="text-sm text-red">{error}</p>}
        <button className="btn btn-primary" disabled={creating}>
          {creating ? "Creating…" : "Create user"}
        </button>
      </form>

      <div className="card divide-y divide-line">
        {loading && <p className="p-4 text-sm text-grey">Loading…</p>}
        {!loading && users.length === 0 && <p className="p-4 text-sm text-grey">No users yet.</p>}
        {users.map((u) => (
          <div key={u.id} className="p-4 flex flex-wrap items-center gap-3 justify-between">
            <div>
              <p className="font-medium">{u.full_name ?? "—"}</p>
              <p className="text-xs text-grey">{u.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="input !w-auto"
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole, u.branch_id)}
              >
                <option value="auditor">Auditor</option>
                <option value="branch">Branch</option>
                <option value="admin">Admin</option>
                <option value="utility_admin">Utility Admin</option>
              </select>
              {u.role === "branch" && <span className="text-xs text-grey">{u.branch?.name ?? "no branch"}</span>}
              <button onClick={() => handleDelete(u.id)} className="btn btn-secondary text-xs">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      </main>
    </div>
  );
}