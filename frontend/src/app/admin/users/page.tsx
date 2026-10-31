"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError, UserOut } from "@/lib/api";

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
      <h1 className="text-xl font-semibold mb-1">Users</h1>
      <p className="text-sm text-slate-500 mb-6">
        Role-based access control: intake registers scans, reviewer corrects, approver signs off and locks, admin
        manages the system.
      </p>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">
                  <select
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
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
                </td>
                <td className="px-4 py-2">
                  <button
                    className={`text-xs font-medium ${u.active ? "text-red-600" : "text-emerald-700"}`}
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

      <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Add user</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Temporary password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="rounded-md bg-emerald-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50">
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
