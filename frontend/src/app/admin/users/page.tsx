"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError, UserOut } from "@/lib/api";
import { ChevronDown } from "lucide-react";

const ROLES = ["admin", "approver", "reviewer", "intake", "viewer"];

function UsersAdmin() {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    api.listUsers().then(setUsers).catch(() => setUsers([]));
  }
  useEffect(reload, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createUser({ email, name, password, role });
      setEmail("");
      setName("");
      setPassword("");
      setRole("viewer");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Users</h1>

      <div className="bg-white/[0.04] border border-white/10 rounded-lg overflow-hidden overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-white/10 text-blue-100/45 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/10">
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2 text-blue-100/45">{u.email}</td>
                <td className="px-4 py-2">
                  <div className="relative inline-block">
                    <select
                      className="appearance-none rounded-md border border-white/15 bg-white/[0.04] text-white px-2 py-1 pr-7 text-sm hover:border-white/25 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition cursor-pointer"
                      value={u.role}
                      onChange={async (e) => {
                        await api.updateUser(u.id, { role: e.target.value });
                        reload();
                      }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-100/45" />
                  </div>
                </td>
                <td className="px-4 py-2">
                  <button
                    className={`text-xs font-medium ${u.active ? "text-red-400" : "text-emerald-400"}`}
                    onClick={async () => {
                      await api.updateUser(u.id, { active: !u.active });
                      reload();
                    }}
                  >
                    {u.active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="bg-white/[0.04] border border-white/10 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-blue-100/80">Add user</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="rounded-md border border-white/15 bg-white/[0.04] text-white placeholder-blue-100/40 px-3 py-2 text-sm" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded-md border border-white/15 bg-white/[0.04] text-white placeholder-blue-100/40 px-3 py-2 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="rounded-md border border-white/15 bg-white/[0.04] text-white placeholder-blue-100/40 px-3 py-2 text-sm" placeholder="Temporary password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <div className="relative">
            <select
              className="w-full appearance-none rounded-lg border border-white/15 bg-white/[0.04] text-white px-3 py-2 pr-9 text-sm hover:border-white/25 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition cursor-pointer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-100/45" />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 active:scale-[0.97] transition shadow-sm disabled:opacity-50 disabled:hover:bg-blue-600">
          {busy ? "Creating…" : "Create user"}
        </button>
      </form>
    </div>
  );
}

export default function UsersAdminPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <UsersAdmin />
    </RequireAuth>
  );
}
