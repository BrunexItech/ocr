"use client";

import { useRef, useState, useCallback } from "react";
import RequireAuth from "@/components/RequireAuth";
import { Copy, Trash2, Upload } from "lucide-react";

type ZoneBox = { id: string; key: string; x: number; y: number; width: number; height: number };

const MAX_DISPLAY_WIDTH = 820;

function ZoneTool() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [zones, setZones] = useState<ZoneBox[]>([]);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  function loadFile(f: File | null) {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const probe = new Image();
    probe.onload = () => {
      const w = probe.naturalWidth;
      const h = probe.naturalHeight;
      setNaturalSize({ w, h });
      const viewportBudget = typeof window !== "undefined" ? window.innerWidth - 32 : MAX_DISPLAY_WIDTH;
      setScale(Math.min(1, MAX_DISPLAY_WIDTH / w, viewportBudget / w));
      setImageUrl(url);
      setZones([]);
    };
    probe.src = url;
  }

  const toNatural = useCallback(
    (clientX: number, clientY: number) => {
      const img = imgRef.current;
      if (!img) return { x: 0, y: 0 };
      const rect = img.getBoundingClientRect();
      return {
        x: Math.round((clientX - rect.left) / scale),
        y: Math.round((clientY - rect.top) / scale),
      };
    },
    [scale]
  );

  function onPointerDown(e: React.PointerEvent) {
    const { x, y } = toNatural(e.clientX, e.clientY);
    setDrawing({ startX: x, startY: y, x, y });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drawing) return;
    const { x, y } = toNatural(e.clientX, e.clientY);
    setDrawing((d) => (d ? { ...d, x, y } : d));
  }
  function onPointerUp() {
    if (!drawing) return;
    const x = Math.min(drawing.startX, drawing.x);
    const y = Math.min(drawing.startY, drawing.y);
    const width = Math.abs(drawing.x - drawing.startX);
    const height = Math.abs(drawing.y - drawing.startY);
    setDrawing(null);
    if (width < 4 || height < 4) return;
    setZones((prev) => [
      ...prev,
      { id: `${Date.now()}`, key: `field_${prev.length + 1}`, x, y, width, height },
    ]);
  }

  function updateKey(id: string, key: string) {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, key } : z)));
  }
  function removeZone(id: string) {
    setZones((prev) => prev.filter((z) => z.id !== id));
  }

  function copyJson() {
    const payload = {
      zones: zones.map(({ key, x, y, width, height }) => ({ key, x, y, width, height })),
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const drawBox = drawing
    ? {
        left: Math.min(drawing.startX, drawing.x) * scale,
        top: Math.min(drawing.startY, drawing.y) * scale,
        width: Math.abs(drawing.x - drawing.startX) * scale,
        height: Math.abs(drawing.y - drawing.startY) * scale,
      }
    : null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold mb-1">Zone template tool</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Upload a real scan, drag to draw a box over each field, name it, then copy the JSON straight into a{" "}
        <code className="text-zinc-400">POST /api/documents/ocr-zones</code> request. Coordinates are in pixels of{" "}
        <b>this exact uploaded image</b> — no cropping or straightening is applied before you draw, so what you
        see here is the coordinate space the API expects.
      </p>

      {!imageUrl ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900 p-10 text-center">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-5 py-2.5 text-sm font-semibold hover:bg-emerald-700 transition"
          >
            <Upload className="w-4 h-4" />
            Upload a sample scan
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={(e) => loadFile(e.target.files?.[0] || null)}
          />
        </div>
      ) : (
        <>
          <p className="text-xs text-zinc-500 mb-2">
            Image: {naturalSize?.w}×{naturalSize?.h}px (displayed at {Math.round(scale * 100)}% — drawn coordinates
            are converted back to full resolution automatically)
          </p>
          <div
            className="relative inline-block select-none touch-none rounded-lg overflow-hidden border border-zinc-800"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Sample scan"
              draggable={false}
              style={{ width: (naturalSize?.w || 0) * scale, height: (naturalSize?.h || 0) * scale }}
              className="block"
            />
            {zones.map((z) => (
              <div
                key={z.id}
                className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none"
                style={{ left: z.x * scale, top: z.y * scale, width: z.width * scale, height: z.height * scale }}
              >
                <span className="absolute -top-5 left-0 text-[10px] font-mono text-emerald-400 bg-black/70 px-1 rounded whitespace-nowrap">
                  {z.key}
                </span>
              </div>
            ))}
            {drawBox && (
              <div
                className="absolute border-2 border-dashed border-amber-400 bg-amber-400/10 pointer-events-none"
                style={drawBox}
              />
            )}
          </div>

          <div className="flex items-center justify-between mt-4 mb-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="text-sm text-zinc-400 hover:text-zinc-200 underline"
            >
              Load a different image
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => loadFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              disabled={zones.length === 0}
              onClick={copyJson}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 transition"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? "Copied!" : "Copy zones JSON"}
            </button>
          </div>

          <div className="space-y-2">
            {zones.length === 0 && <p className="text-sm text-zinc-500">Drag on the image above to add your first zone.</p>}
            {zones.map((z) => (
              <div key={z.id} className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2">
                <input
                  value={z.key}
                  onChange={(e) => updateKey(z.id, e.target.value)}
                  className="flex-1 bg-transparent text-sm text-zinc-100 font-mono outline-none"
                />
                <span className="text-xs text-zinc-500 font-mono whitespace-nowrap">
                  x:{z.x} y:{z.y} w:{z.width} h:{z.height}
                </span>
                <button onClick={() => removeZone(z.id)} className="p-1 text-zinc-500 hover:text-red-400" aria-label="Remove zone">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ZoneToolPage() {
  return (
    <RequireAuth roles={["admin"]}>
      <ZoneTool />
    </RequireAuth>
  );
}
