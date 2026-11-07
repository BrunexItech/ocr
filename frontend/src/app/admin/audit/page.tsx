"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, AuditEvent } from "@/lib/api";

function AuditAdmin() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [verify, setVerify] = useState<{ ok: boolean; count?: number; reason?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listAudit().then(setEvents).catch(() => setEvents([]));
  }, []);

  async function onVerify() {
    setBusy(true);
    try {
      setVerify(await api.verifyAudit());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Audit trail</h1>
        <button onClick={onVerify} disabled={busy} className="rounded-lg bg-white/10 text-white px-5 py-2.5 text-sm font-semibold hover:bg-white/20 active:scale-[0.97] transition shadow-sm disabled:opacity-50 self-start sm:self-auto whitespace-nowrap">
          {busy ? "Verifying…" : "Verify chain integrity"}
        </button>
      </div>

      {verify && (
        <div className={`rounded-md border p-3 text-sm mb-4 ${verify.ok ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
          {verify.ok ? `Chain intact · ${verify.count} events verified.` : `Tampering detected: ${verify.reason}`}
        </div>
      )}

      <div className="bg-white/[0.04] border border-white/10 rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-white/10 text-blue-100/45 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">#</th>
              <th className="text-left px-4 py-2">Time</th>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-left px-4 py-2">Action</th>
              <th className="text-left px-4 py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.seq} className="border-t border-white/10">
                <td className="px-4 py-2 font-mono text-xs text-blue-100/45">{e.seq}</td>
                <td className="px-4 py-2 text-xs text-blue-100/45 whitespace-nowrap">{new Date(e.ts).toLocaleString()}</td>
                <td className="px-4 py-2">{e.user}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-2 text-blue-100/45">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AuditAdminPage() {
  return (
    <RequireAuth roles={["admin", "approver"]}>
      <AuditAdmin />
    </RequireAuth>
  );
}
