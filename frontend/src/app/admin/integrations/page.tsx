"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError, IntegrationOut } from "@/lib/api";
import { ChevronDown } from "lucide-react";

function IntegrationsAdmin() {
  const [items, setItems] = useState<IntegrationOut[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("webhook");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    api.listIntegrations().then(setItems).catch(() => setItems([]));
  }
  useEffect(reload, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.createIntegration({ name, kind, config: kind === "webhook" ? { url } : {} });
      setName("");
      setUrl("");
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create integration");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Integrations</h1>
      <p className="text-sm text-blue-100/45 mb-6">
        Destinations that approved records can push selected fields to — a webhook into your own database or
        another system. This is the &quot;select what you want fed into the database&quot; step.
      </p>

      <div className="bg-white/[0.04] border border-white/10 rounded-lg overflow-hidden overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-white/10 text-blue-100/45 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Kind</th>
              <th className="text-left px-4 py-2">Config</th>
              <th className="text-left px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-white/10">
                <td className="px-4 py-2">{i.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{i.kind}</td>
                <td className="px-4 py-2 text-blue-100/45 text-xs">{JSON.stringify(i.config)}</td>
                <td className="px-4 py-2">{i.active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-blue-100/45">
                  No integrations configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="bg-white/[0.04] border border-white/10 rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-blue-100/80">New integration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className="rounded-md border border-white/15 bg-white/[0.04] text-white placeholder-blue-100/40 px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="relative">
            <select
              className="w-full appearance-none rounded-lg border border-white/15 bg-white/[0.04] text-white px-3 py-2 pr-9 text-sm hover:border-white/25 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition cursor-pointer"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="webhook">Webhook (push to a URL)</option>
              <option value="csv_export">CSV export (manual)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-100/45" />
          </div>
        </div>
        {kind === "webhook" && (
          <input
            className="w-full rounded-md border border-white/15 bg-white/[0.04] text-white placeholder-blue-100/40 px-3 py-2 text-sm"
            placeholder="https://your-system.example.com/api/ingest"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 active:scale-[0.97] transition shadow-sm disabled:opacity-50 disabled:hover:bg-blue-600">
          {busy ? "Creating…" : "Create integration"}
        </button>
      </form>
    </div>
  );
}

export default function IntegrationsAdminPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <IntegrationsAdmin />
    </RequireAuth>
  );
}
