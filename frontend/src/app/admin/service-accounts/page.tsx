"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError, ServiceAccountOut } from "@/lib/api";
import { ChevronDown, Copy, Trash2 } from "lucide-react";

function ServiceAccountsAdmin() {
  const [items, setItems] = useState<ServiceAccountOut[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("intake");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<{ name: string; api_key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reload() {
    api.listServiceAccounts().then(setItems).catch(() => setItems([]));
  }
  useEffect(reload, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNewKey(null);
    try {
      const created = await api.createServiceAccount({ name, role });
      setNewKey({ name: created.name, api_key: created.api_key });
      setName("");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create service account");
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    if (!window.confirm("Revoke this API key? Anything using it will stop working immediately.")) return;
    await api.revokeServiceAccount(id);
    reload();
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Service accounts</h1>

      {newKey && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 mb-6">
          <p className="text-sm font-medium text-emerald-400 mb-2">
            Key created for &quot;{newKey.name}&quot; — copy it now, it won&apos;t be shown again:
          </p>
          <div className="flex items-center gap-2 bg-black/30 rounded-md px-3 py-2">
            <code className="text-xs text-white break-all flex-1">{newKey.api_key}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(newKey.api_key);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white/[0.04] border border-white/10 rounded-lg overflow-hidden overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-white/10 text-blue-100/45 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Key</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Active</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} className="border-t border-white/10">
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-blue-100/45">{a.key_prefix}…</td>
                <td className="px-4 py-2 text-xs">{a.role}</td>
                <td className="px-4 py-2">{a.active ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-right">
                  {a.active && (
                    <button onClick={() => onRevoke(a.id)} className="p-1 text-blue-100/45 hover:text-red-400" aria-label="Revoke">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-blue-100/45">
                  No service accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="bg-white/[0.04] border border-white/10 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-blue-100/80">New service account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="rounded-md border border-white/15 bg-white/[0.04] text-white placeholder-blue-100/40 px-3 py-2 text-sm"
            placeholder="e.g. sports.oqtekal.com"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="relative">
            <select
              className="w-full appearance-none rounded-lg border border-white/15 bg-white/[0.04] text-white px-3 py-2 pr-9 text-sm hover:border-white/25 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition cursor-pointer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="intake">intake</option>
              <option value="viewer">viewer</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-100/45" />
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 active:scale-[0.97] transition shadow-sm disabled:opacity-50 disabled:hover:bg-blue-600">
          {busy ? "Creating…" : "Create service account"}
        </button>
      </form>
    </div>
  );
}

export default function ServiceAccountsAdminPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <ServiceAccountsAdmin />
    </RequireAuth>
  );
}
