"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Spinner from "@/components/Spinner";
import { X } from "lucide-react";
import { getToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Box = { left: number; top: number; right: number; bottom: number };

const DETECT_INTERVAL_MS = 280; // how often we ask the server "is there a document here" - was 450ms
const DETECT_SEND_SIZE = 420; // downscaled frame size sent to the server for detection (smaller = faster round-trip)
const STABILITY_FRAMES = 3; // consecutive server detections required before auto-capture
const STABILITY_TOLERANCE = 20; // px of allowed edge drift between detections to count as "stable"
const LERP_FACTOR = 0.35; // how fast the on-screen box glides toward each new detection, per animation frame

function boxDistance(a: Box, b: Box): number {
  return (Math.abs(a.left - b.left) + Math.abs(a.top - b.top) + Math.abs(a.right - b.right) + Math.abs(a.bottom - b.bottom)) / 4;
}

function quadToBox(points: { x: number; y: number }[]): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}

function lerpBox(a: Box, b: Box, t: number): Box {
  return {
    left: a.left + (b.left - a.left) * t,
    top: a.top + (b.top - a.top) * t,
    right: a.right + (b.right - a.right) * t,
    bottom: a.bottom + (b.bottom - a.bottom) * t,
  };
}

export type ScanMode = "document" | "id_card" | "passport";

const MODE_LABEL: Record<ScanMode, string> = {
  document: "Point the camera at the document",
  id_card: "Place the ID card inside the frame",
  passport: "Place the passport's photo page inside the frame",
};

type Status = "starting_camera" | "live" | "detecting" | "camera_error";

/**
 * Live camera scanner. Detection runs server-side, reusing the same proven OpenCV
 * contour algorithm (find_document_contour) that the backend's own auto-crop pipeline
 * uses - so "found it" in the live preview matches what actually gets cropped on
 * capture. The client never re-implements edge/contour detection itself.
 */
export default function LiveScanner({
  mode = "document",
  onCapture,
  onClose,
}: {
  mode?: ScanMode;
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const sendCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<Box[]>([]);
  const capturedRef = useRef(false);
  const inFlightRef = useRef(false);
  // Detection results land here at network speed (every DETECT_INTERVAL_MS); a
  // separate animation loop glides the on-screen box toward this target every
  // frame, so the overlay looks smooth and alive instead of snapping each time a
  // server response arrives.
  const targetBoxRef = useRef<Box | null>(null);
  const animBoxRef = useRef<Box | null>(null);
  const stableCountRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const [status, setStatus] = useState<Status>("starting_camera");
  const [errorMsg, setErrorMsg] = useState("");
  const [hasBox, setHasBox] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
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

  // Always captures the full raw frame - the backend's already-proven auto-crop/
  // straighten pipeline (same algorithm used for detection here) does the real
  // cropping during OCR processing, so we never ship a client-side crop that could
  // clip the document or include the background table.
  const captureNow = useCallback(() => {
    if (capturedRef.current) return;
    capturedRef.current = true;
    setStatus("detecting");
    const video = videoRef.current!;
    const out = document.createElement("canvas");
    out.width = video.videoWidth;
    out.height = video.videoHeight;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(video, 0, 0, out.width, out.height);
    out.toBlob(finishCapture, "image/jpeg", 0.92);
  }, [finishCapture]);

  useEffect(() => {
    let cancelled = false;
    capturedRef.current = false;
    historyRef.current = [];
    inFlightRef.current = false;

    async function detectOnce() {
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const send = sendCanvasRef.current;
      if (!video || !overlay || !send || video.videoWidth === 0 || inFlightRef.current || capturedRef.current) {
        return;
      }
      inFlightRef.current = true;
      try {
        const scale = DETECT_SEND_SIZE / Math.max(video.videoWidth, video.videoHeight);
        const sw = Math.round(video.videoWidth * scale);
        const sh = Math.round(video.videoHeight * scale);
        send.width = sw;
        send.height = sh;
        send.getContext("2d")!.drawImage(video, 0, 0, sw, sh);
        const blob: Blob | null = await new Promise((resolve) => send.toBlob(resolve, "image/jpeg", 0.7));
        if (!blob || cancelled || capturedRef.current) return;

        const form = new FormData();
        form.append("file", blob, "frame.jpg");
        const token = getToken();
        const res = await fetch(`${API_URL}/api/documents/detect-frame`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        if (!res.ok || cancelled || capturedRef.current) return;
        const result = await res.json();

        if (result.found && Array.isArray(result.points) && result.width && result.height) {
          const toFull = video.videoWidth / result.width;
          const box = quadToBox(result.points.map((p: { x: number; y: number }) => ({ x: p.x * toFull, y: p.y * toFull })));
          setHasBox(true);
          targetBoxRef.current = box;

          const hist = historyRef.current;
          hist.push(box);
          if (hist.length > STABILITY_FRAMES) hist.shift();
          stableCountRef.current = hist.length;
          if (hist.length === STABILITY_FRAMES) {
            const drift = Math.max(...hist.slice(1).map((b, i) => boxDistance(b, hist[i])));
            if (drift < STABILITY_TOLERANCE) {
              captureNow();
              return;
            }
            // Drifting too much to count as stable yet - don't let the count sit maxed
            // out and falsely read as "locked" in the overlay color.
            stableCountRef.current = STABILITY_FRAMES - 1;
          }
        } else {
          setHasBox(false);
          historyRef.current = [];
          targetBoxRef.current = null;
          stableCountRef.current = 0;
        }
      } catch {
        // transient network/detection hiccup - just try again on the next tick
      } finally {
        inFlightRef.current = false;
        if (!cancelled && !capturedRef.current) {
          timerRef.current = setTimeout(detectOnce, DETECT_INTERVAL_MS);
        }
      }
    }

    // Draws every animation frame (60fps), independent of the network-speed detection
    // poll - the box glides toward wherever the latest server detection placed it, so
    // motion looks fluid even though real detections only arrive every ~280ms. Corner
    // brackets (viewfinder-style) rather than a full rectangle, colored amber while
    // still searching and glowing green once it's held steady long enough to capture.
    function drawFrame() {
      const overlay = overlayRef.current;
      const video = videoRef.current;
      if (overlay && video && video.videoWidth) {
        if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
          overlay.width = video.videoWidth;
          overlay.height = video.videoHeight;
        }
        const octx = overlay.getContext("2d")!;
        octx.clearRect(0, 0, overlay.width, overlay.height);

        const target = targetBoxRef.current;
        if (target) {
          animBoxRef.current = animBoxRef.current ? lerpBox(animBoxRef.current, target, LERP_FACTOR) : target;
          const box = animBoxRef.current;
          const progress = Math.min(stableCountRef.current / STABILITY_FRAMES, 1);
          const color = progress >= 1 ? "#22e3a0" : progress > 0.5 ? "#9fe08a" : "#fbbf24";
          const bracket = Math.min(box.right - box.left, box.bottom - box.top) * 0.18;

          octx.save();
          octx.strokeStyle = color;
          octx.lineWidth = progress >= 1 ? 6 : 4;
          octx.shadowColor = color;
          octx.shadowBlur = progress >= 1 ? 20 : 8;
          octx.lineCap = "round";
          octx.lineJoin = "round";
          const corners: [number, number, number, number][] = [
            [box.left, box.top, 1, 1],
            [box.right, box.top, -1, 1],
            [box.left, box.bottom, 1, -1],
            [box.right, box.bottom, -1, -1],
          ];
          for (const [cx, cy, dx, dy] of corners) {
            octx.beginPath();
            octx.moveTo(cx, cy + bracket * dy);
            octx.lineTo(cx, cy);
            octx.lineTo(cx + bracket * dx, cy);
            octx.stroke();
          }
          octx.restore();
        } else {
          animBoxRef.current = null;
        }
      }
      rafRef.current = requestAnimationFrame(drawFrame);
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
        timerRef.current = setTimeout(detectOnce, DETECT_INTERVAL_MS);
        rafRef.current = requestAnimationFrame(drawFrame);
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
          {status === "live" && (hasBox ? "Hold steady…" : MODE_LABEL[mode])}
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
        <canvas ref={sendCanvasRef} className="hidden" />

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
                className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold hover:bg-blue-700"
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
            onClick={captureNow}
            className="w-16 h-16 rounded-full bg-[#0a1430] ring-4 ring-white/30 active:scale-95 transition"
            aria-label="Capture"
          />
        )}
        <p className="text-white/60 text-xs text-center">Captures automatically, or tap the button anytime.</p>
      </div>
    </div>
  );
}
