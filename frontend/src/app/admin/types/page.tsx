"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError, DocumentType } from "@/lib/api";
import { ChevronDown, Lock } from "lucide-react";
import { humanizeFieldKey } from "@/lib/format";

type FieldRow = { key: string; label: string; type: string; required: boolean; sensitive: boolean };

const FIELD_PREVIEW_COUNT = 5;

function FieldChips({ schema }: { schema: DocumentType["fields_schema"] }) {
  const [expanded, setExpanded] = useState(false);
  const entries = Object.entries(schema || {});
  const shown = expanded ? entries : entries.slice(0, FIELD_PREVIEW_COUNT);
  const remaining = entries.length - shown.length;

  if (entries.length === 0) return <span className="text-blue-100/35 text-sm">No fields configured</span>;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {shown.map(([k, v]) => (
        <span
          key={k}
          className="inline-flex items-center gap-1.5 rounded-md bg-white/10 border border-white/15 text-blue-100/80 text-xs font-medium px-2.5 py-1 whitespace-nowrap"
          title={v.label || humanizeFieldKey(k)}
        >
          {v.required && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
          {humanizeFieldKey(k)}
          {v.sensitive && <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />}
        </span>
      ))}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="inline-flex items-center rounded-md text-blue-400 text-xs font-medium px-2 py-1 hover:text-blue-300 transition"
        >
          +{remaining} more
        </button>
      )}
      {expanded && entries.length > FIELD_PREVIEW_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="inline-flex items-center rounded-md text-blue-100/45 text-xs font-medium px-2 py-1 hover:text-blue-100/80 transition"
        >
          Show less
        </button>
      )}
    </div>
  );
}

function TypesAdmin() {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("generic");
  const [fields, setFields] = useState<FieldRow[]>([{ key: "", label: "", type: "text", required: false, sensitive: false }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    api.listDocumentTypes().then(setTypes).catch(() => setTypes([]));
  }
  useEffect(reload, []);

  function updateField(i: number, patch: Partial<FieldRow>) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields_schema: DocumentType["fields_schema"] = {};
      for (const f of fields) {
        if (!f.key) continue;
        fields_schema[f.key] = { label: f.label || f.key, type: f.type, required: f.required, sensitive: f.sensitive };
      }
      await api.createDocumentType({ code, name, domain, fields_schema, default_sensitivity: "internal" });
      setCode("");
      setName("");
      setFields([{ key: "", label: "", type: "text", required: false, sensitive: false }]);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create type");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Document types</h1>
      <p className="text-sm text-blue-100/45 mb-6">
        Fully configurable schemas — this is what makes the same OCR pipeline work for a school, a hospital, a
        fintech KYC desk, or any other domain without changing code.
      </p>

      <div className="bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden mb-6 shadow-sm">
        {types.length > 0 && (
          <div className="px-5 py-2.5 border-b border-white/10 flex items-center gap-4 text-[11px] text-blue-100/45">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Required
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-amber-400" /> Sensitive
            </span>
          </div>
        )}
        {types.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-blue-100/45">
            No document types yet. Run <code className="text-blue-100/60">python -m scripts.seed_templates</code> or create one below.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {types.map((t) => (
              <div key={t.id} className="px-5 py-5 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="sm:w-56 shrink-0">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-blue-100/45 mt-0.5">
                    <span className="font-mono text-blue-100/60">{t.code}</span>
                    <span className="mx-1.5">·</span>
                    <span className="capitalize">{t.domain}</span>
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <FieldChips schema={t.fields_schema} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="bg-white/[0.04] border border-white/10 rounded-xl p-5 sm:p-6 space-y-6 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-white">New document type</h2>
          <p className="text-xs text-blue-100/45 mt-0.5">Define the schema once — every scan of this type extracts these fields automatically.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input className="rounded-lg border border-white/15 bg-white/[0.03] text-white placeholder-blue-100/40 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition" placeholder="Code (e.g. INVOICE)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          <input className="rounded-lg border border-white/15 bg-white/[0.03] text-white placeholder-blue-100/40 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded-lg border border-white/15 bg-white/[0.03] text-white placeholder-blue-100/40 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition" placeholder="Domain (school, hospital, fintech…)" value={domain} onChange={(e) => setDomain(e.target.value)} />
        </div>

        <div className="space-y-3">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_120px_110px_28px] gap-3 px-3 text-[11px] font-medium text-blue-100/45 uppercase tracking-wide">
            <span>Key</span>
            <span>Label</span>
            <span>Type</span>
            <span>Flags</span>
            <span />
          </div>
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_120px_110px_28px] gap-2 sm:gap-3 items-center bg-white/[0.03] border border-white/10 rounded-lg p-3 sm:p-2.5">
              <input className="col-span-2 sm:col-span-1 rounded-md border border-white/15 bg-white/[0.04] text-white placeholder-blue-100/40 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition" placeholder="key" value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} />
              <input className="col-span-2 sm:col-span-1 rounded-md border border-white/15 bg-white/[0.04] text-white placeholder-blue-100/40 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition" placeholder="label" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-md border border-white/15 bg-white/[0.04] text-white px-2 py-1.5 pr-7 text-sm hover:border-white/25 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition cursor-pointer"
                  value={f.type}
                  onChange={(e) => updateField(i, { type: e.target.value })}
                >
                  <option value="text">text</option>
                  <option value="number">number</option>
                  <option value="date">date</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-100/45" />
              </div>
              <div className="flex gap-2.5 text-xs text-blue-100/60 whitespace-nowrap">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" className="accent-blue-500" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                  req
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" className="accent-blue-500" checked={f.sensitive} onChange={(e) => updateField(i, { sensitive: e.target.checked })} />
                  sensitive
                </label>
              </div>
              <button
                type="button"
                onClick={() => setFields((prev) => prev.filter((_, idx) => idx !== i))}
                disabled={fields.length === 1}
                className="justify-self-end text-blue-100/45 hover:text-red-400 disabled:opacity-30 disabled:hover:text-blue-100/45 transition text-sm font-medium"
                aria-label="Remove field"
                title="Remove field"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-sm text-blue-400 font-medium hover:text-blue-300 transition"
            onClick={() => setFields((prev) => [...prev, { key: "", label: "", type: "text", required: false, sensitive: false }])}
          >
            + Add field
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 active:scale-[0.97] transition shadow-sm disabled:opacity-50 disabled:hover:bg-blue-600">
          {busy ? "Creating…" : "Create document type"}
        </button>
      </form>
    </div>
  );
}

export default function TypesAdminPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <TypesAdmin />
    </RequireAuth>
  );
}
