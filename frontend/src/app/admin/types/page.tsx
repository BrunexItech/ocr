"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError, DocumentType } from "@/lib/api";

type FieldRow = { key: string; label: string; type: string; required: boolean; sensitive: boolean };

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
      <p className="text-sm text-zinc-500 mb-6">
        Fully configurable schemas — this is what makes the same OCR pipeline work for a school, a hospital, a
        fintech KYC desk, or any other domain without changing code.
      </p>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden overflow-x-auto mb-6">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-zinc-800 text-zinc-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Code</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Domain</th>
              <th className="text-left px-4 py-2">Fields</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} className="border-t border-zinc-800">
                <td className="px-4 py-2 font-mono">{t.code}</td>
                <td className="px-4 py-2">{t.name}</td>
                <td className="px-4 py-2 text-zinc-500">{t.domain}</td>
                <td className="px-4 py-2 text-zinc-500">
                  {Object.entries(t.fields_schema)
                    .map(([k, v]) => `${k}${v.required ? "*" : ""}${v.sensitive ? " (sensitive)" : ""}`)
                    .join(", ")}
                </td>
              </tr>
            ))}
            {types.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-zinc-500">
                  No document types yet. Run <code>python -m scripts.seed_templates</code> or create one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-300">New document type</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input className="rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2 text-sm" placeholder="Code (e.g. INVOICE)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          <input className="rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2 text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2 text-sm" placeholder="Domain (school, hospital, fintech…)" value={domain} onChange={(e) => setDomain(e.target.value)} />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500 uppercase">Fields</p>
          {fields.map((f, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
              <input className="col-span-2 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-2 py-1.5 text-sm" placeholder="key" value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} />
              <input className="col-span-2 rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-2 py-1.5 text-sm" placeholder="label" value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} />
              <select className="rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-2 py-1.5 text-sm" value={f.type} onChange={(e) => updateField(i, { type: e.target.value })}>
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="date">date</option>
              </select>
              <div className="flex gap-2 text-xs text-zinc-500">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                  req
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={f.sensitive} onChange={(e) => updateField(i, { sensitive: e.target.checked })} />
                  sensitive
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="text-xs text-emerald-400 font-medium"
            onClick={() => setFields((prev) => [...prev, { key: "", label: "", type: "text", required: false, sensitive: false }])}
          >
            + Add field
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="rounded-lg bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 active:scale-[0.97] transition shadow-sm disabled:opacity-50 disabled:hover:bg-emerald-600">
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
