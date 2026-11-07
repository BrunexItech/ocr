"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import DocThumb from "@/components/DocThumb";
import { api, DocumentOut } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Camera, FileStack, FileText, CheckCircle2, Clock, AlertCircle, Plus, Search, X, Eye, Download } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-white/10 text-blue-100/70",
  processing: "bg-blue-500/15 text-blue-300",
  awaiting_review: "bg-amber-500/15 text-amber-300",
  awaiting_approval: "bg-violet-500/15 text-violet-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-red-500/15 text-red-300",
  failed: "bg-red-500/15 text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  processing: "Processing",
  awaiting_review: "Needs review",
  awaiting_approval: "Pending",
  approved: "Processed",
  rejected: "Rejected",
  failed: "Failed",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[status] || "bg-white/10 text-blue-100/70"}`}>
      {status === "approved" && <CheckCircle2 className="w-3 h-3" />}
      {status === "failed" && <AlertCircle className="w-3 h-3" />}
      {STATUS_LABEL[status] || status.replace("_", " ")}
    </span>
  );
}

function StatCard({ icon: Icon, value, label, tone }: { icon: typeof FileText; value: number; label: string; tone: string }) {
  return (
    <div className="flex-1 min-w-[150px] bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex items-center gap-3.5">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}>
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-white leading-tight">{value}</p>
        <p className="text-xs text-blue-100/60 truncate">{label}</p>
      </div>
    </div>
  );
}

function DocumentsList() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocumentOut[]>([]);
  const [allDocs, setAllDocs] = useState<DocumentOut[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listDocuments().then(setAllDocs).catch(() => setAllDocs([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    api
      .listDocuments(filter || undefined, debouncedSearch || undefined)
      .then((d) => !cancelled && setDocs(d))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filter, debouncedSearch]);

  const stats = {
    total: allDocs.length,
    processed: allDocs.filter((d) => d.status === "approved").length,
    pending: allDocs.filter((d) => ["awaiting_review", "awaiting_approval", "queued", "processing"].includes(d.status)).length,
    failed: allDocs.filter((d) => ["failed", "rejected"].includes(d.status)).length,
  };

  const tabs = [
    ["", "All"],
    ["awaiting_review", "Needs review"],
    ["awaiting_approval", "Awaiting approval"],
    ["approved", "Processed"],
    ["rejected", "Rejected"],
    ["failed", "Failed"],
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white flex items-center justify-center shadow-md shadow-blue-900/40 flex-shrink-0">
            <FileText className="w-5.5 h-5.5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">Documents</h1>
            <p className="text-xs text-blue-100/60">Manage and track your OCR processed documents</p>
          </div>
        </div>
        <Link
          href="/intake"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2.5 text-sm font-semibold hover:from-blue-700 hover:to-blue-600 transition shadow-md"
        >
          <Plus className="w-4 h-4" />
          Scan or Upload Document
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <StatCard icon={FileText} value={stats.total} label="Total Documents" tone="bg-blue-500/15 text-blue-300" />
        <StatCard icon={CheckCircle2} value={stats.processed} label="Processed Successfully" tone="bg-emerald-500/15 text-emerald-300" />
        <StatCard icon={Clock} value={stats.pending} label="Pending Processing" tone="bg-amber-500/15 text-amber-300" />
        <StatCard icon={AlertCircle} value={stats.failed} label="Failed" tone="bg-red-500/15 text-red-300" />
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-100/40" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents by name, type, or status…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder-blue-100/40 pl-10 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-100/40 hover:text-white"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1.5 mb-6 overflow-x-auto no-scrollbar pb-0.5">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === value ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-sm" : "text-blue-100/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 text-blue-100/50">
          <FileStack className="w-12 h-12 mb-3" strokeWidth={1.5} />
          {debouncedSearch ? (
            <p className="text-sm">No documents match &ldquo;{debouncedSearch}&rdquo;.</p>
          ) : (
            <>
              <p className="text-sm">No scans here yet.</p>
              <Link href="/intake" className="text-blue-400 text-sm font-medium mt-2">Scan your first document →</Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {docs.map((d) => (
            <div key={d.id} className="group bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden card-float hover:border-blue-500/30 transition">
              <Link href={`/documents/${d.id}`} className="block aspect-[3/4] bg-black/30 relative overflow-hidden">
                <DocThumb docId={d.id} className="w-full h-full" />
                <div className="absolute top-2 left-2">
                  <StatusChip status={d.status} />
                </div>
                {d.ocr_confidence != null && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">
                    {(d.ocr_confidence * 100).toFixed(0)}%
                  </div>
                )}
              </Link>
              <div className="p-3">
                <p className="text-xs font-semibold text-white truncate">{d.title || d.tracking_no}</p>
                <p className="text-[11px] text-blue-100/50 truncate mt-0.5">
                  {d.detected_kind}
                  {d.title && <span className="font-mono"> · {d.tracking_no}</span>}
                </p>
                <div className="flex gap-1.5 mt-2.5">
                  <Link
                    href={`/documents/${d.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-100/80 text-[11px] font-medium py-1.5 transition"
                  >
                    <Eye className="w-3 h-3" />
                    View
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      api.downloadOriginal(d.id, d.file_name || d.title || d.tracking_no);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white/5 hover:bg-white/10 text-blue-100/80 text-[11px] font-medium py-1.5 transition"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {["admin", "intake"].includes(user?.role || "") && (
        <Link
          href="/intake"
          className="sm:hidden fixed bottom-6 right-5 w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-sky-400 text-white flex items-center justify-center shadow-lg z-30"
          aria-label="Scan a document"
        >
          <Camera className="w-6 h-6" />
        </Link>
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
