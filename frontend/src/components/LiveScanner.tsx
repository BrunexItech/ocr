"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Spinner from "@/components/Spinner";
import { X } from "lucide-react";

type Box = { left: number; top: number; right: number; bottom: number };

const STABILITY_FRAMES = 6; // consecutive detections required before auto-capture
const STABILITY_TOLERANCE = 10; // px of allowed edge drift between frames to count as "stable"
const MIN_AREA_FRACTION = 0.15; // detected box must cover at least this much of the frame
const MAX_AREA_FRACTION = 0.97; // ...but not basically the whole frame (= no real edge found)
const WORK_SIZE = 220; // downscale target for the detector - this is what keeps it instant/cheap

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function boxDistance(a: Box, b: Box): number {
  return (Math.abs(a.left - b.left) + Math.abs(a.top - b.top) + Math.abs(a.right - b.right) + Math.abs(a.bottom - b.bottom)) / 4;
}

/**
 * Fast, pure-JS document-edge heuristic: no WASM, no download, runs every frame.
 * Works by comparing row/column average brightness against the border (assumed
 * background) brightness to find where a contrasting rectangular object starts/ends.
 * This is intentionally simple - it only has to decide WHEN to auto-capture. The real
 * perspective-correction/cropping already happens server-side (OpenCV, Python) during
 * OCR processing, so this client-side box doesn't need to be pixel-perfect.
 */
function detectDocumentBox(imageData: ImageData, w: number, h: number): Box | null {
  const data = imageData.data;
  const rowAvg = new Float32Array(h);
  const colAvg = new Float32Array(w);

  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    const base = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = base + x * 4;
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      rowSum += lum;
      colAvg[x] += lum;
    }
    rowAvg[y] = rowSum / w;
  }
  for (let x = 0; x < w; x++) colAvg[x] /= h;

  const marginX = Math.max(2, Math.floor(w * 0.08));
  const marginY = Math.max(2, Math.floor(h * 0.08));
  const bgSamples: number[] = [];
  for (let y = 0; y < marginY; y++) bgSamples.push(rowAvg[y], rowAvg[h - 1 - y]);
  for (let x = 0; x < marginX; x++) bgSamples.push(colAvg[x], colAvg[w - 1 - x]);
  const bg = median(bgSamples);
  const threshold = 24;

  const findEdge = (arr: Float32Array, len: number, fromStart: boolean): number | null => {
    const dir = fromStart ? 1 : -1;
    const start = fromStart ? 0 : len - 1;
    let runLen = 0;
    for (let i = 0; i < len; i++) {
      const idx = start + dir * i;
      const isFg = Math.abs(arr[idx] - bg) > threshold;
      if (isFg) {
        runLen++;
        if (runLen === 3) return idx - dir * 2;
      } else {
        runLen = 0;
      }
    }
    return null;
  };

  const top = findEdge(rowAvg, h, true);
  const bottom = findEdge(rowAvg, h, false);
  const left = findEdge(colAvg, w, true);
  const right = findEdge(colAvg, w, false);
  if (top == null || bottom == null || left == null || right == null) return null;
  if (bottom <= top || right <= left) return null;

  const area = (bottom - top) * (right - left);
  const frameArea = w * h;
  if (area < frameArea * MIN_AREA_FRACTION || area > frameArea * MAX_AREA_FRACTION) return null;
  return { left, top, right, bottom };
}

type Status = "starting_camera" | "live" | "detecting" | "camera_error";

export default function LiveScanner({
  onCapture,
  onClose,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const workRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const historyRef = useRef<Box[]>([]);
  const capturedRef = useRef(false);
  const lastBoxRef = useRef<Box | null>(null);

  const [status, setStatus] = useState<Status>("starting_camera");
  const [errorMsg, setErrorMsg] = useState("");
  const [hasBox, setHasBox] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finishCapture = useCallback(
    (blob: Blob | null) => {
      stop();
      if (blob) onCapture(new File([blob], `scan_${Date.now()}.jpg`, { type: "image/jpeg" }));
    },
    [onCapture, stop]
  );

  // Crops to the detected box (with a little padding) when available; otherwise takes
  // the full raw frame. Either way, the backend re-detects edges and straightens the
  // image properly during OCR processing - this client-side crop is just a nicety.
  const captureNow = useCallback(
    (box?: Box) => {
      if (capturedRef.current) return;
      capturedRef.current = true;
      setStatus("detecting");
      const video = videoRef.current!;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      let sx = 0, sy = 0, sw = vw, sh = vh;
      if (box) {
        const padX = (box.right - box.left) * 0.04;
        const padY = (box.bottom - box.top) * 0.04;
        sx = Math.max(0, box.left - padX);
        sy = Math.max(0, box.top - padY);
        sw = Math.min(vw - sx, box.right - box.left + padX * 2);
        sh = Math.min(vh - sy, box.bottom - box.top + padY * 2);
      }

      const out = document.createElement("canvas");
      out.width = Math.round(sw);
      out.height = Math.round(sh);
      const ctx = out.getContext("2d")!;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, out.width, out.height);
      out.toBlob(finishCapture, "image/jpeg", 0.92);
    },
    [finishCapture]
  );

  useEffect(() => {
    let cancelled = false;
    capturedRef.current = false;
    historyRef.current = [];

    function loop() {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const work = workRef.current;
      if (!video || !overlay || !work || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const scale = WORK_SIZE / video.videoWidth;
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      work.width = w;
      work.height = h;
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      const wctx = work.getContext("2d", { willReadFrequently: true })!;
      wctx.drawImage(video, 0, 0, w, h);

      let box: Box | null = null;
      try {
        const imageData = wctx.getImageData(0, 0, w, h);
        const small = detectDocumentBox(imageData, w, h);
        if (small) {
          box = {
            left: small.left / scale,
            top: small.top / scale,
            right: small.right / scale,
            bottom: small.bottom / scale,
          };
        }
      } catch {
        box = null;
      }

      const octx = overlay.getContext("2d")!;
      octx.clearRect(0, 0, overlay.width, overlay.height);
      setHasBox(!!box);

      if (box) {
        lastBoxRef.current = box;
        octx.strokeStyle = "#10d99a";
        octx.lineWidth = 4;
        octx.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);

        const hist = historyRef.current;
        hist.push(box);
        if (hist.length > STABILITY_FRAMES) hist.shift();
        if (hist.length === STABILITY_FRAMES) {
          const drift = Math.max(...hist.slice(1).map((b, i) => boxDistance(b, hist[i])));
          if (drift < STABILITY_TOLERANCE) {
            captureNow(box);
            return;
          }
        }
      } else {
        historyRef.current = [];
        lastBoxRef.current = null;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 1280 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        setStatus("live");
        loop();
      } catch (err) {
        if (!cancelled) {
          setStatus("camera_error");
          setErrorMsg(
            err instanceof Error && err.name === "NotAllowedError"
              ? "Camera access was blocked. Allow camera permission for this site and try again."
              : "Could not access the camera on this device."
          );
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  const cameraFailed = status === "camera_error";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-medium">
          {status === "starting_camera" && "Starting camera…"}
          {status === "live" && (hasBox ? "Hold steady…" : "Point at a document")}
          {status === "detecting" && "Capturing…"}
          {cameraFailed && "Camera unavailable"}
        </span>
        <button onClick={() => { stop(); onClose(); }} className="p-2 -mr-2" aria-label="Close scanner">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
        <canvas ref={overlayRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
        <canvas ref={workRef} className="hidden" />

        {status === "starting_camera" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
            <Spinner className="w-9 h-9" light />
            <p className="text-sm text-white/80">Starting camera…</p>
          </div>
        )}
        {status === "detecting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
            <Spinner className="w-9 h-9" light />
          </div>
        )}
        {cameraFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white bg-black/90">
            <p className="text-sm">{errorMsg}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStatus("starting_camera");
                  setErrorMsg("");
                  setRetryKey((k) => k + 1);
                }}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold hover:bg-emerald-700"
              >
                Try again
              </button>
              <button onClick={onClose} className="rounded-full border border-white/30 px-5 py-2 text-sm font-semibold">
                Use file upload instead
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col items-center gap-3">
        {status === "live" && (
          <button
            onClick={() => captureNow(lastBoxRef.current || undefined)}
            className="w-16 h-16 rounded-full bg-zinc-900 ring-4 ring-white/30 active:scale-95 transition"
            aria-label="Capture"
          />
        )}
        <p className="text-white/60 text-xs text-center">Captures automatically, or tap the button anytime.</p>
      </div>
    </div>
  );
}
