"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError, ServiceAccountOut } from "@/lib/api";
import { Copy, Trash2 } from "lucide-react";

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
      <h1 className="text-xl font-semibold mb-1">Service accounts</h1>
      <p className="text-sm text-zinc-500 mb-6">
        API keys for other systems (e.g. sports.oqtekal.com) to call the zone-mode OCR endpoint directly, without a
        human login. A key can only call <code className="text-zinc-400">ocr-zones</code> and{" "}
        <code className="text-zinc-400">zones-health</code> — nothing else.
      </p>

      {newKey && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 mb-6">
          <p className="text-sm font-medium text-emerald-400 mb-2">
            Key created for &quot;{newKey.name}&quot; — copy it now, it won&apos;t be shown again:
          </p>
          <div className="flex items-center gap-2 bg-black/30 rounded-md px-3 py-2">
            <code className="text-xs text-zinc-200 break-all flex-1">{newKey.api_key}</code>
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

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-zinc-800 text-zinc-500 text-xs uppercase">
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
              <tr key={a.id} className="border-t border-zinc-800">
                <td className="px-4 py-2">{a.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-zinc-500">{a.key_prefix}…</td>
                <td className="px-4 py-2 text-xs">{a.role}</td>
                <td className="px-4 py-2">{a.active ? "Yes" : "No"}</td>
                <td className="px-4 py-2 text-right">
                  {a.active && (
                    <button onClick={() => onRevoke(a.id)} className="p-1 text-zinc-500 hover:text-red-400" aria-label="Revoke">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-zinc-500">
                  No service accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-300">New service account</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2 text-sm"
            placeholder="e.g. sports.oqtekal.com"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            className="rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="intake">intake</option>
            <option value="viewer">viewer</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 active:scale-[0.97] transition shadow-sm disabled:opacity-50 disabled:hover:bg-emerald-600">
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
