"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import DocThumb from "@/components/DocThumb";
import { api, DocumentOut } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Camera, Clock, CheckCircle2, FileStack, Plus, FileSearch, Search, X } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  queued: "bg-zinc-800 text-zinc-400",
  processing: "bg-blue-500/10 text-blue-400",
  awaiting_review: "bg-amber-500/10 text-amber-400",
  awaiting_approval: "bg-violet-500/10 text-violet-400",
  approved: "bg-emerald-500/10 text-emerald-400",
  rejected: "bg-red-500/10 text-red-400",
  failed: "bg-red-500/10 text-red-400",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] || "bg-zinc-800 text-zinc-400"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function QuickAction({ icon, label, onClick, href }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <span className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 group-hover:border-emerald-500/40 transition">
        {icon}
      </span>
      <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition">{label}</span>
    </>
  );
  const cls = "group flex flex-col items-center gap-1.5";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

function DocumentsList() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<DocumentOut[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);

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
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold">Documents</h1>
        <Link
          href="/intake"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Scan
        </Link>
      </div>

      {["admin", "intake"].includes(user?.role || "") && (
        <div className="flex items-center gap-6 mb-6 overflow-x-auto pb-1">
          <QuickAction icon={<Camera className="w-5 h-5" />} label="Scan" href="/intake" />
          <QuickAction icon={<FileSearch className="w-5 h-5" />} label="Needs review" onClick={() => setFilter("awaiting_review")} />
          <QuickAction icon={<Clock className="w-5 h-5" />} label="Awaiting approval" onClick={() => setFilter("awaiting_approval")} />
          <QuickAction icon={<CheckCircle2 className="w-5 h-5" />} label="Approved" onClick={() => setFilter("approved")} />
          <QuickAction icon={<FileStack className="w-5 h-5" />} label="All" onClick={() => setFilter("")} />
        </div>
      )}

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, tracking number, or document contents…"
          className="w-full rounded-full border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder-zinc-500 pl-10 pr-9 py-2.5 text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-5 border-b border-zinc-800 overflow-x-auto">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              filter === value ? "border-emerald-600 text-emerald-400" : "border-transparent text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-xl bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 text-zinc-500">
          <FileStack className="w-12 h-12 mb-3" strokeWidth={1.5} />
          {debouncedSearch ? (
            <p className="text-sm">No documents match &ldquo;{debouncedSearch}&rdquo;.</p>
          ) : (
            <>
              <p className="text-sm">No scans here yet.</p>
              <Link href="/intake" className="text-emerald-400 text-sm font-medium mt-2">Scan your first document →</Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {docs.map((d) => (
            <Link
              key={d.id}
              href={`/documents/${d.id}`}
              className="group block bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden card-float"
            >
              <div className="aspect-[3/4] bg-zinc-800 relative overflow-hidden">
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
                <p className="text-xs font-semibold text-zinc-200 truncate">{d.title || d.tracking_no}</p>
                <p className="text-xs text-zinc-500 truncate mt-0.5">
                  {d.detected_kind}
                  {d.title && <span className="font-mono"> · {d.tracking_no}</span>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {["admin", "intake"].includes(user?.role || "") && (
        <Link
          href="/intake"
          className="sm:hidden fixed bottom-6 right-5 w-14 h-14 rounded-full brand-grad text-white flex items-center justify-center shadow-lg z-30"
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
