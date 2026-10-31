"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import DocThumb from "@/components/DocThumb";
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
        <Link
          href="/intake"
          className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 transition shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Scan
        </Link>
      </div>
      <div className="flex gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 text-slate-400">
          <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-6 4h6M7 21h10a2 2 0 002-2V7.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0014.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          <p className="text-sm">No scans here yet.</p>
          <Link href="/intake" className="text-emerald-700 text-sm font-medium mt-2">Scan your first document →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {docs.map((d) => (
            <Link
              key={d.id}
              href={`/documents/${d.id}`}
              className="group block bg-white border border-slate-200 rounded-xl overflow-hidden card-float"
            >
              <div className="aspect-[3/4] bg-slate-50 relative overflow-hidden">
                <DocThumb docId={d.id} className="w-full h-full" />
                <div className="absolute top-2 left-2">
                  <StatusChip status={d.status} />
                </div>
                {d.ocr_confidence != null && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">
                    {(d.ocr_confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="text-xs font-mono text-slate-700 truncate">{d.tracking_no}</p>
                <p className="text-xs text-slate-400 truncate mt-0.5">{d.detected_kind}</p>
              </div>
            </Link>
          ))}
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
