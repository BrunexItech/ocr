"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { api, DocumentOut } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-slate-100 text-slate-600",
  processing: "bg-blue-50 text-blue-700",
  awaiting_review: "bg-amber-50 text-amber-700",
  awaiting_approval: "bg-violet-50 text-violet-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  failed: "bg-red-50 text-red-700",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] || "bg-slate-100 text-slate-600"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function DocumentsList() {
  const [docs, setDocs] = useState<DocumentOut[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listDocuments(filter || undefined)
      .then(setDocs)
      .finally(() => setLoading(false));
  }, [filter]);

  const tabs = [
    ["", "All"],
    ["awaiting_review", "Needs review"],
    ["awaiting_approval", "Awaiting approval"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["failed", "Failed"],
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Documents</h1>
        <Link href="/intake" className="text-sm font-medium text-emerald-700">
          + New intake
        </Link>
      </div>
      <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              filter === value ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate-500">No documents here.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Tracking no.</th>
                <th className="text-left px-4 py-2 font-medium">File</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Confidence</th>
                <th className="text-left px-4 py-2 font-medium">Reasons</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/documents/${d.id}`} className="font-mono text-emerald-700">
                      {d.tracking_no}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600 max-w-[220px] truncate">{d.file_name}</td>
                  <td className="px-4 py-2">
                    <StatusChip status={d.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">{d.ocr_confidence != null ? `${(d.ocr_confidence * 100).toFixed(0)}%` : "—"}</td>
                  <td className="px-4 py-2 text-slate-500 max-w-[280px] truncate">{d.reasons.join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <RequireAuth>
      <DocumentsList />
    </RequireAuth>
  );
}
