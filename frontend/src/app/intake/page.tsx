"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import LiveScanner, { ScanMode } from "@/components/LiveScanner";
import Spinner from "@/components/Spinner";
import { api, ApiError, DocumentType } from "@/lib/api";
import { Camera, Check, ChevronDown, CreditCard, FileText, RotateCcw, ScanLine, Upload, X } from "lucide-react";

type Mode = "extract" | "document_only";

const SCAN_CARDS: { mode: ScanMode; label: string; hint: string; icon: typeof FileText }[] = [
  { mode: "document", label: "Document", hint: "Letters, invoices, receipts, forms", icon: FileText },
  { mode: "id_card", label: "ID card", hint: "National ID, driver's license", icon: CreditCard },
  { mode: "passport", label: "Passport", hint: "Photo page with MRZ", icon: ScanLine },
];

// Show just the document, not the background it was photographed on: once a side
// is captured, ask the backend to auto-crop/straighten it the same way the real
// intake pipeline will, and swap the raw preview for that - instead of displaying
// the untouched photo the camera handed us. Shared by both front and back since
// either can be captured/retaken independently.
function useCroppedPreview(src: File | null, setPreviewUrl: (u: string | null) => void, setBusy: (b: boolean) => void) {
  useEffect(() => {
    if (!src || !src.type.startsWith("image/")) return;
    let cancelled = false;
    queueMicrotask(() => !cancelled && setBusy(true));
    api
      .cropPreview(src)
      .then((blob) => {
        if (cancelled) return;
        setPreviewUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        /* keep whatever preview was already there if cropping fails */
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
}

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
  const [capturingSide, setCapturingSide] = useState<"front" | "back" | "extra">("front");
  const [previewSide, setPreviewSide] = useState<"front" | "back">("front");
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [backCropping, setBackCropping] = useState(false);
  const [extraPages, setExtraPages] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [cropping, setCropping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const needsBackSide = scanMode === "id_card";
  const supportsMultiPage = scanMode === "document";

  useEffect(() => {
    api.listDocumentTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  function pickFile(f: File | null) {
    setFile(f);
    setBackFile(null);
    setExtraPages([]);
    setCapturingSide("front");
    setPreviewSide("front");
    setResult(null);
    setError("");
    setTypeId("");
    setTitle("");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f && f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  // Extra-page thumbnails: plain object URLs (not run through the crop-preview
  // endpoint) so adding a page feels instant - the backend still auto-crops every
  // page for real once the scan is submitted.
  const extraPreviews = useMemo(() => extraPages.map((p) => URL.createObjectURL(p)), [extraPages]);
  useEffect(() => () => extraPreviews.forEach((u) => URL.revokeObjectURL(u)), [extraPreviews]);

  useCroppedPreview(file, (url) => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, setCropping);

  useCroppedPreview(backFile, (url) => {
    setBackPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, setBackCropping);

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
        backFile || undefined,
        extraPages
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
      <p className="text-sm text-blue-100/45 mb-6">
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
              setPreviewSide("back");
            } else if (capturingSide === "extra") {
              setExtraPages((prev) => [...prev, f]);
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
                  className="flex flex-col items-center gap-1.5 sm:gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 sm:p-4 text-center hover:border-blue-600/50 hover:bg-white/10 transition card-float"
                >
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl brand-grad text-white flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-white">{label}</span>
                  <span className="hidden sm:block text-[11px] text-blue-100/45 leading-tight">{hint}</span>
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
                dragOver ? "border-emerald-500 bg-emerald-500/10" : "border-white/15 bg-white/[0.04]"
              }`}
            >
              <p className="text-xs text-blue-100/45 mb-3">Or drop a file — PDF, JPG, PNG, WEBP, up to 25MB</p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-blue-100/80 hover:bg-white/10 transition"
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
          <div className="space-y-2.5">
            {needsBackSide && (
              <div className="inline-flex p-1 rounded-full bg-white/[0.04] border border-white/10 gap-1">
                <button
                  type="button"
                  onClick={() => setPreviewSide("front")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                    previewSide === "front" ? "bg-blue-600 text-white shadow-sm" : "text-blue-100/60 hover:text-white"
                  }`}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => backFile && setPreviewSide("back")}
                  disabled={!backFile}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                    previewSide === "back" ? "bg-blue-600 text-white shadow-sm" : "text-blue-100/60 hover:text-white"
                  } ${!backFile ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  Back
                  {backFile && <Check className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}

            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewSide === "back" ? backPreview || "" : preview}
                alt={previewSide === "back" ? "Back side preview" : "Preview"}
                className={`w-full max-h-[380px] object-contain transition ${
                  (previewSide === "back" ? backCropping : cropping) ? "opacity-40 blur-[1px]" : ""
                }`}
              />
              {(previewSide === "back" ? backCropping : cropping) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30">
                  <Spinner className="w-7 h-7" light />
                  <p className="text-xs text-white/80">Trimming to the document…</p>
                </div>
              )}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                {needsBackSide && backFile && (
                  <button
                    type="button"
                    onClick={() => {
                      setCapturingSide(previewSide);
                      setScannerOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 bg-black/60 hover:bg-white/[0.04] rounded-full pl-3 pr-3.5 py-1.5 text-xs font-semibold text-white shadow transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retake {previewSide === "front" ? "Front" : "Back"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => pickFile(null)}
                  className="bg-black/60 hover:bg-white/[0.04] rounded-full p-2 shadow transition"
                  aria-label="Remove"
                >
                  <X className="w-4 h-4 text-blue-100/80" />
                </button>
              </div>
            </div>
          </div>
        )}

        {file && !file.type.startsWith("image/") && (
          <div className="flex items-center gap-2 text-sm text-blue-100/60 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2">
            <FileText className="w-4 h-4 text-blue-100/45" />
            {file.name}
          </div>
        )}

        {file && needsBackSide && !backFile && !result && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
            <span className="text-sm text-amber-300">ID cards need the back scanned too</span>
            <button
              type="button"
              onClick={() => {
                setCapturingSide("back");
                setScannerOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-semibold hover:bg-blue-700 active:scale-95 transition whitespace-nowrap shadow-sm"
            >
              <Camera className="w-3.5 h-3.5" />
              Scan back
            </button>
          </div>
        )}

        {file && supportsMultiPage && !result && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-blue-100/80 flex items-center gap-2">
                {extraPages.length > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold shrink-0">
                    {extraPages.length + 1}
                  </span>
                )}
                {extraPages.length > 0 ? "pages scanned" : "Multi-page document?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCapturingSide("extra");
                  setScannerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 text-white px-4 py-2 text-xs font-semibold hover:bg-blue-700 active:scale-95 transition whitespace-nowrap shadow-sm"
              >
                <Camera className="w-3.5 h-3.5" />
                {extraPages.length > 0 ? "Add another page" : "Add a page"}
              </button>
            </div>
            {extraPages.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {extraPreviews.map((url, i) => (
                  <div key={i} className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Page ${i + 2}`} className="w-14 h-14 rounded-lg object-cover border border-white/15" />
                    <span className="absolute -top-1.5 -left-1.5 bg-white/10 text-blue-100/80 text-[10px] font-semibold rounded-full w-5 h-5 flex items-center justify-center border border-white/25">
                      {i + 2}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExtraPages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 bg-white/[0.04] rounded-full p-0.5 border border-white/15"
                      aria-label={`Remove page ${i + 2}`}
                    >
                      <X className="w-3 h-3 text-blue-100/80" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {file && !result && (
          <>
            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 card-float">
              <label className="block text-sm font-medium text-blue-100/80 mb-1.5">Name this scan (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. John Doe - National ID, Q3 invoice from Acme"
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] text-white placeholder-blue-100/40 px-3 py-2 text-sm"
              />
              <p className="text-xs text-blue-100/45 mt-1.5">Makes it easy to find later — search by name instead of the tracking number.</p>
            </div>

            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 card-float">
              <label className="block text-sm font-medium text-blue-100/80 mb-1.5">Document type (for structured extraction)</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-white/15 bg-white/[0.04] text-white px-3 py-2.5 pr-9 text-sm hover:border-white/25 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 outline-none transition cursor-pointer"
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                >
                  <option value="">Auto-detect (MRZ / invoice heuristics)</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.domain})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-100/45" />
              </div>
            </div>

            <p className="text-sm font-medium text-blue-100/80 pt-1">What do you want to do with this scan?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!!busyMode}
                onClick={() => submit("extract")}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white p-3.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {busyMode === "extract" && <Spinner className="w-4 h-4" light />}
                {busyMode === "extract" ? "Reading document…" : "Extract & save to database"}
              </button>
              <button
                type="button"
                disabled={!!busyMode}
                onClick={() => submit("document_only")}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] p-3.5 text-sm font-semibold text-blue-100/80 hover:bg-white/10 disabled:opacity-50 transition"
              >
                {busyMode === "document_only" && <Spinner className="w-4 h-4" />}
                {busyMode === "document_only" ? "Saving…" : "Just keep the scanned document"}
              </button>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {result && (
          <div className="rounded-2xl bg-white/[0.04] border border-emerald-500/30 p-5 card-float">
            <div className="flex items-start gap-3 mb-4">
              <span className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-white">{result.detectedKind}</p>
                <p className="text-xs text-blue-100/45 font-mono mt-0.5">{result.tracking_no}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium px-2.5 py-1">
                {result.status.replace("_", " ")}
              </span>
              {result.confidence != null && (
                <span className="inline-flex items-center rounded-full bg-white/10 text-blue-100/60 text-xs font-medium px-2.5 py-1">
                  {(result.confidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/documents")}
                className="flex-1 rounded-lg bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition shadow-sm"
              >
                View in queue
              </button>
              <button
                type="button"
                onClick={() => pickFile(null)}
                className="flex-1 rounded-lg border border-white/15 bg-white/[0.04] text-white px-4 py-2.5 text-sm font-semibold hover:bg-white/10 active:scale-[0.98] transition"
              >
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
