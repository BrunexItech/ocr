"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import LiveScanner, { ScanMode } from "@/components/LiveScanner";
import Spinner from "@/components/Spinner";
import { Camera, Check, RotateCcw } from "lucide-react";
import { humanizeFieldKey } from "@/lib/format";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type EmbedField = { key: string; value: string | null; confidence: number; bbox: null };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function EmbedScanPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-zinc-950" />}>
      <EmbedScanInner />
    </Suspense>
  );
}

function EmbedScanInner() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const parentOrigin = params.get("parentOrigin"); // if omitted, postMessage uses "*" - less safe, but works without the parent having to know its own origin
  const mode = (params.get("kind") as ScanMode) || "document";

  const [scannerOpen, setScannerOpen] = useState(true);
  const [status, setStatus] = useState<"idle" | "extracting" | "review" | "sent" | "error">("idle");
  const [fields, setFields] = useState<EmbedField[]>([]);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  if (!token) {
    return (
      <div className="h-screen flex items-center justify-center text-center p-6 bg-zinc-950 text-zinc-300">
        <p className="text-sm">Missing <code>token</code> query parameter. Exchange your API key for an embed token first.</p>
      </div>
    );
  }

  async function handleCapture(file: File) {
    setScannerOpen(false);
    setStatus("extracting");
    setErrorMsg("");
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);

      const form = new FormData();
      form.append("file", file);
      form.append("kind", mode);
      const res = await fetch(`${API_URL}/api/embed/extract`, {
        method: "POST",
        headers: { "X-Embed-Token": token },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(body.detail || "Extraction failed");
      }
      const data = await res.json();
      setFields(data.fields || []);
      setStatus("review");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  function updateField(key: string, value: string) {
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, value } : f)));
  }

  function confirmAndSend() {
    if (!imageDataUrl) return;
    const payload = { type: "oqtekal-ocr-scan", image: imageDataUrl, fields };
    window.parent.postMessage(payload, parentOrigin || "*");
    setStatus("sent");
  }

  function retake() {
    setFields([]);
    setImageDataUrl(null);
    setStatus("idle");
    setScannerOpen(true);
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {scannerOpen && <LiveScanner mode={mode} onCapture={handleCapture} onClose={() => setScannerOpen(false)} />}

      {!scannerOpen && status === "extracting" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Spinner className="w-8 h-8" />
          <p className="text-sm text-zinc-400">Reading document…</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-red-400">{errorMsg}</p>
          <button onClick={retake} className="rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-semibold">
            Try again
          </button>
        </div>
      )}

      {status === "review" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {imageDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageDataUrl} alt="Captured scan" className="w-full max-h-48 object-contain rounded-lg border border-zinc-800" />
          )}
          <p className="text-xs text-zinc-500">Review the fields below, then confirm to send them back.</p>
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs text-zinc-400">{humanizeFieldKey(f.key)}</label>
              <input
                value={f.value ?? ""}
                onChange={(e) => updateField(f.key, e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 text-zinc-100 px-3 py-2 text-sm"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <button
              onClick={confirmAndSend}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition"
            >
              <Check className="w-4 h-4" />
              Confirm & send
            </button>
            <button
              onClick={retake}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Retake
            </button>
          </div>
        </div>
      )}

      {status === "sent" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <Check className="w-8 h-8 text-emerald-400" />
          <p className="text-sm text-zinc-300">Sent back to the page.</p>
          <button
            onClick={retake}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 transition"
          >
            <Camera className="w-4 h-4" />
            Scan another
          </button>
        </div>
      )}
    </div>
  );
}
