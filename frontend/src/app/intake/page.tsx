"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { api, ApiError, DocumentType } from "@/lib/api";

function IntakeForm() {
  const router = useRouter();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [typeId, setTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ tracking_no: string; status: string } | null>(null);

  useEffect(() => {
    api.listDocumentTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const doc = await api.intake(file, typeId || undefined);
      setResult({ tracking_no: doc.tracking_no, status: doc.status });
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-1">Document intake</h1>
      <p className="text-sm text-slate-500 mb-6">
        Register a scan or photo. OCR runs immediately and the record is routed automatically to review
        or approval based on confidence and validation.
      </p>
      <form onSubmit={onSubmit} className="space-y-4 bg-white border border-slate-200 rounded-lg p-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Document type</label>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Auto (no type-specific validation)</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.domain})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">File (PDF, JPG, PNG, WEBP)</label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            Registered as <span className="font-mono font-semibold">{result.tracking_no}</span> → {result.status}.{" "}
            <button type="button" className="underline font-medium" onClick={() => router.push("/documents")}>
              View in queue
            </button>
          </div>
        )}
        <button disabled={busy || !file} className="w-full rounded-md bg-emerald-600 text-white py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
          {busy ? "Processing OCR…" : "Register & run OCR"}
        </button>
      </form>
    </div>
  );
}

export default function IntakePage() {
  return (
    <RequireAuth roles={["admin", "intake"]}>
      <IntakeForm />
    </RequireAuth>
  );
}
