"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import LiveScanner, { ScanMode } from "@/components/LiveScanner";
import Spinner from "@/components/Spinner";
import { api, ApiError, DocumentType } from "@/lib/api";
import { Camera, CreditCard, FileText, RotateCcw, ScanLine, Upload, X } from "lucide-react";

type Mode = "extract" | "document_only";

const SCAN_CARDS: { mode: ScanMode; label: string; hint: string; icon: typeof FileText }[] = [
  { mode: "document", label: "Document", hint: "Letters, invoices, receipts, forms", icon: FileText },
  { mode: "id_card", label: "ID card", hint: "National ID, driver's license", icon: CreditCard },
  { mode: "passport", label: "Passport", hint: "Photo page with MRZ", icon: ScanLine },
];

function IntakeForm() {
  const router = useRouter();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [typeId, setTypeId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ tracking_no: string; status: string; confidence: number | null; detectedKind: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("document");
  const [capturingSide, setCapturingSide] = useState<"front" | "back">("front");
  const [backFile, setBackFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const needsBackSide = scanMode === "id_card";

  useEffect(() => {
    api.listDocumentTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  function pickFile(f: File | null) {
    setFile(f);
    setBackFile(null);
    setCapturingSide("front");
    setResult(null);
    setError("");
    setTypeId("");
    setTitle("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function submit(mode: Mode) {
    if (!file || busyMode) return;
    setBusyMode(mode);
    setError("");
    setResult(null);
    try {
      const doc = await api.intake(
        file,
        mode === "extract" ? typeId || undefined : undefined,
        title.trim() || undefined,
        scanMode,
        backFile || undefined
      );
      setResult({ tracking_no: doc.tracking_no, status: doc.status, confidence: doc.ocr_confidence, detectedKind: doc.detected_kind });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusyMode(null);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Scan a document</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Point your camera at a document — it captures automatically once the edges are detected and steady,
        or tap the shutter yourself anytime.
      </p>

      {scannerOpen && (
        <LiveScanner
          mode={scanMode}
          onCapture={(f) => {
            setScannerOpen(false);
            if (scanMode === "id_card" && capturingSide === "back") {
              setBackFile(f);
            } else {
              pickFile(f);
              if (scanMode === "id_card") setCapturingSide("back");
            }
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <div className="space-y-4">
        {!preview ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              {SCAN_CARDS.map(({ mode, label, hint, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setScanMode(mode);
                    setScannerOpen(true);
                  }}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-center hover:border-emerald-600/50 hover:bg-zinc-800/60 transition card-float"
                >
                  <div className="w-11 h-11 rounded-xl brand-grad text-white flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-200">{label}</span>
                  <span className="text-[11px] text-zinc-500 leading-tight">{hint}</span>
                </button>
              ))}
            </div>

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
              className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                dragOver ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-700 bg-zinc-900"
              }`}
            >
              <p className="text-xs text-zinc-500 mb-3">Or drop a file — PDF, JPG, PNG, WEBP, up to 25MB</p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 transition"
              >
                <Upload className="w-4 h-4" />
                Choose file
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
              />
            </div>
          </>
        ) : (
          <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview" className="w-full max-h-[380px] object-contain" />
            <button
              type="button"
              onClick={() => pickFile(null)}
              className="absolute top-3 right-3 bg-zinc-900/90 hover:bg-zinc-900 rounded-full p-1.5 shadow"
              aria-label="Remove"
            >
              <X className="w-4 h-4 text-zinc-300" />
            </button>
          </div>
        )}

        {file && !file.type.startsWith("image/") && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
            <FileText className="w-4 h-4 text-zinc-500" />
            {file.name}
          </div>
        )}

        {file && needsBackSide && !result && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 flex items-center justify-between gap-3">
            {backFile ? (
              <>
                <span className="text-sm text-emerald-400 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Back side captured
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCapturingSide("back");
                    setScannerOpen(true);
                  }}
                  className="text-xs font-medium text-zinc-400 hover:text-zinc-200 underline"
                >
                  Retake
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-zinc-300">ID cards need the back scanned too</span>
                <button
                  type="button"
                  onClick={() => {
                    setCapturingSide("back");
                    setScannerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-emerald-700 transition whitespace-nowrap"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Scan back
                </button>
              </>
            )}
          </div>
        )}

        {file && !result && (
          <>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 card-float">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name this scan (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. John Doe - National ID, Q3 invoice from Acme"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2 text-sm"
              />
              <p className="text-xs text-zinc-500 mt-1.5">Makes it easy to find later — search by name instead of the tracking number.</p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 card-float">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Document type (for structured extraction)</label>
              <select className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2 text-sm" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">Auto-detect (MRZ / invoice heuristics)</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.domain})
                  </option>
                ))}
              </select>
            </div>

            <p className="text-sm font-medium text-zinc-300 pt-1">What do you want to do with this scan?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!!busyMode}
                onClick={() => submit("extract")}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white p-3.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {busyMode === "extract" && <Spinner className="w-4 h-4" light />}
                {busyMode === "extract" ? "Reading document…" : "Extract & save to database"}
              </button>
              <button
                type="button"
                disabled={!!busyMode}
                onClick={() => submit("document_only")}
                className="flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition"
              >
                {busyMode === "document_only" && <Spinner className="w-4 h-4" />}
                {busyMode === "document_only" ? "Saving…" : "Just keep the scanned document"}
              </button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {result && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-sm text-emerald-400">
            <p className="font-medium mb-1">
              Detected: {result.detectedKind} · <span className="font-mono">{result.tracking_no}</span>
            </p>
            <p className="text-emerald-400">
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
      </div>
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
