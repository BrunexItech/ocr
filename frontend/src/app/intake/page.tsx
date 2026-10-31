"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import LiveScanner from "@/components/LiveScanner";
import { api, ApiError, DocumentType } from "@/lib/api";

type Mode = "extract" | "document_only";

function IntakeForm() {
  const router = useRouter();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [typeId, setTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ tracking_no: string; status: string; confidence: number | null; detectedKind: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.listDocumentTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  function pickFile(f: File | null) {
    setFile(f);
    setResult(null);
    setError("");
    setMode(null);
    setTypeId("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !mode) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const doc = await api.intake(file, mode === "extract" ? typeId || undefined : undefined);
      setResult({ tracking_no: doc.tracking_no, status: doc.status, confidence: doc.ocr_confidence, detectedKind: doc.detected_kind });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Scan a document</h1>
      <p className="text-sm text-slate-500 mb-6">
        Point your camera at a document — it captures automatically once the edges are detected and steady.
      </p>

      {scannerOpen && (
        <LiveScanner
          onCapture={(f) => {
            setScannerOpen(false);
            pickFile(f);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {!preview ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              pickFile(e.dataTransfer.files?.[0] || null);
            }}
            className={`rounded-2xl border-2 border-dashed p-10 text-center transition ${
              dragOver ? "border-emerald-500 bg-emerald-50" : "border-slate-300 bg-white"
            }`}
          >
            <div className="w-14 h-14 rounded-2xl brand-grad text-white flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            </div>
            <p className="font-medium text-slate-700 mb-1">Drop a file, or choose below</p>
            <p className="text-xs text-slate-400 mb-5">PDF, JPG, PNG, WEBP — up to 25MB</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3" /></svg>
                Live scan
              </button>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Choose file
              </button>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview" className="w-full max-h-[420px] object-contain" />
            <button
              type="button"
              onClick={() => pickFile(null)}
              className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full p-1.5 shadow"
              aria-label="Remove"
            >
              <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {file && !file.type.startsWith("image/") && (
          <div className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 21h10a2 2 0 002-2V7.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0014.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            {file.name}
          </div>
        )}

        {file && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 card-float">
            <p className="text-sm font-medium text-slate-700 mb-2.5">What do you want to do with this scan?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("extract")}
                className={`text-left rounded-xl border p-3 transition ${mode === "extract" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <p className="text-sm font-semibold text-slate-800">Extract &amp; save to database</p>
                <p className="text-xs text-slate-500 mt-0.5">Pull out structured fields and route through review/approval.</p>
              </button>
              <button
                type="button"
                onClick={() => setMode("document_only")}
                className={`text-left rounded-xl border p-3 transition ${mode === "document_only" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}
              >
                <p className="text-sm font-semibold text-slate-800">Just keep the scanned document</p>
                <p className="text-xs text-slate-500 mt-0.5">Store the cleaned-up scan and its text, without picking a schema.</p>
              </button>
            </div>
          </div>
        )}

        {mode === "extract" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 card-float">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Document type</label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">Auto-detect (MRZ / invoice heuristics)</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.domain})
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800">
            <p className="font-medium mb-1">
              Detected: {result.detectedKind} · <span className="font-mono">{result.tracking_no}</span>
            </p>
            <p className="text-emerald-700">
              Status: {result.status.replace("_", " ")}
              {result.confidence != null && ` · ${(result.confidence * 100).toFixed(0)}% confidence`}
            </p>
            <div className="flex gap-3 mt-3">
              <button type="button" className="underline font-medium" onClick={() => router.push("/documents")}>
                View in queue
              </button>
              <button type="button" className="underline font-medium" onClick={() => pickFile(null)}>
                Scan another
              </button>
            </div>
          </div>
        )}

        {!result && file && (
          <button
            disabled={busy || !mode}
            className="w-full rounded-full bg-emerald-600 text-white py-3 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 transition shadow-sm"
          >
            {busy ? "Reading document…" : "Scan & extract"}
          </button>
        )}
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
