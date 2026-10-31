"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadOpenCV, OpenCVNamespace } from "@/lib/opencv-loader";
import Spinner from "@/components/Spinner";

type Point = { x: number; y: number };

const STABILITY_FRAMES = 6; // consecutive detections required before auto-capture
const STABILITY_TOLERANCE = 14; // px of allowed corner drift between frames to count as "stable"
const MIN_AREA_FRACTION = 0.18; // detected quad must cover at least this much of the frame

function orderCorners(pts: Point[]): Point[] {
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]]; // tl, tr, br, bl
}

function cornerDistance(a: Point[], b: Point[]): number {
  return a.reduce((sum, p, i) => sum + Math.hypot(p.x - b[i].x, p.y - b[i].y), 0) / a.length;
}

type Status = "starting_camera" | "live" | "detecting" | "camera_error" | "engine_error";

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
  const historyRef = useRef<Point[][]>([]);
  const capturedRef = useRef(false);
  const cvRef = useRef<OpenCVNamespace | null>(null);
  const lastQuadRef = useRef<Point[] | null>(null);

  const [status, setStatus] = useState<Status>("starting_camera");
  const [errorMsg, setErrorMsg] = useState("");
  const [hasQuad, setHasQuad] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
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

  // Crops+straightens via the detected quad when available; otherwise just takes the
  // raw frame as-is. Used by both auto-capture and the manual shutter button.
  const captureNow = useCallback(
    (quad?: Point[]) => {
      if (capturedRef.current) return;
      capturedRef.current = true;
      setStatus("detecting");
      const video = videoRef.current!;
      const full = document.createElement("canvas");
      full.width = video.videoWidth;
      full.height = video.videoHeight;
      const ctx = full.getContext("2d")!;
      ctx.drawImage(video, 0, 0, full.width, full.height);

      const cv = cvRef.current;
      if (!quad || !cv) {
        full.toBlob(finishCapture, "image/jpeg", 0.92);
        return;
      }

      const ordered = orderCorners(quad);
      const widthA = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
      const widthB = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
      const heightA = Math.hypot(ordered[1].x - ordered[2].x, ordered[1].y - ordered[2].y);
      const heightB = Math.hypot(ordered[0].x - ordered[3].x, ordered[0].y - ordered[3].y);
      const outW = Math.max(widthA, widthB);
      const outH = Math.max(heightA, heightB);

      try {
        const src = cv.imread(full);
        const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flatMap((p) => [p.x, p.y]));
        const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]);
        const m = cv.getPerspectiveTransform(srcPts, dstPts);
        const dst = new cv.Mat();
        cv.warpPerspective(src, dst, m, new cv.Size(Math.round(outW), Math.round(outH)));
        const outCanvas = document.createElement("canvas");
        outCanvas.width = Math.round(outW);
        outCanvas.height = Math.round(outH);
        cv.imshow(outCanvas, dst);
        src.delete();
        srcPts.delete();
        dstPts.delete();
        m.delete();
        dst.delete();
        outCanvas.toBlob(finishCapture, "image/jpeg", 0.92);
      } catch {
        full.toBlob(finishCapture, "image/jpeg", 0.92);
      }
    },
    [finishCapture]
  );

  useEffect(() => {
    let cancelled = false;
    capturedRef.current = false;
    historyRef.current = [];

    function loop() {
      const cv = cvRef.current;
      const video = videoRef.current;
      const overlay = overlayRef.current;
      const work = workRef.current;
      if (!cv || !video || !overlay || !work || video.videoWidth === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const scale = 480 / video.videoWidth;
      const w = Math.round(video.videoWidth * scale);
      const h = Math.round(video.videoHeight * scale);
      work.width = w;
      work.height = h;
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      const wctx = work.getContext("2d")!;
      wctx.drawImage(video, 0, 0, w, h);

      let quad: Point[] | null = null;
      try {
        const src = cv.imread(work);
        const gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        const blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        const edges = new cv.Mat();
        cv.Canny(blurred, edges, 50, 150);
        const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
        cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        const frameArea = w * h;
        let bestArea = 0;
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt);
          if (area > frameArea * MIN_AREA_FRACTION && area > bestArea) {
            const peri = cv.arcLength(cnt, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
            if (approx.rows === 4) {
              bestArea = area;
              const pts: Point[] = [];
              for (let j = 0; j < 4; j++) {
                pts.push({ x: approx.data32S[j * 2] / scale, y: approx.data32S[j * 2 + 1] / scale });
              }
              quad = pts;
            }
            approx.delete();
          }
          cnt.delete();
        }
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        kernel.delete();
        contours.delete();
        hierarchy.delete();
      } catch {
        quad = null;
      }

      const octx = overlay.getContext("2d")!;
      octx.clearRect(0, 0, overlay.width, overlay.height);
      setHasQuad(!!quad);

      if (quad) {
        const ordered = orderCorners(quad);
        lastQuadRef.current = ordered;
        octx.strokeStyle = "#10d99a";
        octx.lineWidth = 4;
        octx.beginPath();
        octx.moveTo(ordered[0].x, ordered[0].y);
        ordered.slice(1).forEach((p) => octx.lineTo(p.x, p.y));
        octx.closePath();
        octx.stroke();
        ordered.forEach((p) => {
          octx.beginPath();
          octx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          octx.fillStyle = "#10d99a";
          octx.fill();
        });

        const hist = historyRef.current;
        hist.push(ordered);
        if (hist.length > STABILITY_FRAMES) hist.shift();
        if (hist.length === STABILITY_FRAMES) {
          const drift = Math.max(...hist.slice(1).map((q, i) => cornerDistance(q, hist[i])));
          if (drift < STABILITY_TOLERANCE) {
            captureNow(ordered);
            return;
          }
        }
      } else {
        historyRef.current = [];
        lastQuadRef.current = null;
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
        // The camera itself is usable right away - the shutter button works from here,
        // independent of whether the detection engine below loads successfully.
        setStatus("live");
      } catch (err) {
        if (!cancelled) {
          setStatus("camera_error");
          setErrorMsg(
            err instanceof Error && err.name === "NotAllowedError"
              ? "Camera access was blocked. Allow camera permission for this site and try again."
              : "Could not access the camera on this device."
          );
        }
        return;
      }

      // Detection engine loads in the background; auto-capture only activates once ready.
      try {
        const cv = await loadOpenCV();
        if (cancelled) return;
        cvRef.current = cv;
        setEngineReady(true);
        loop();
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Auto-detection engine failed to load");
          // Camera is still live and the shutter button still works - this is a soft failure.
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
          {status === "live" && (hasQuad ? "Hold steady…" : engineReady ? "Point at a document" : "Tap the button to capture")}
          {status === "detecting" && "Capturing…"}
          {cameraFailed && "Camera unavailable"}
        </span>
        <button onClick={() => { stop(); onClose(); }} className="p-2 -mr-2" aria-label="Close scanner">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                  setEngineReady(false);
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
        {status === "live" && !engineReady && errorMsg && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white text-xs px-3 py-1.5 rounded-full">
            Auto-detect unavailable - use the capture button below
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col items-center gap-3">
        {status === "live" && (
          <button
            onClick={() => captureNow(lastQuadRef.current || undefined)}
            className="w-16 h-16 rounded-full bg-white ring-4 ring-white/30 active:scale-95 transition"
            aria-label="Capture"
          />
        )}
        <p className="text-white/60 text-xs text-center">
          {engineReady ? "Captures automatically, or tap the button anytime." : "Tap the button when the document is in frame."}
        </p>
      </div>
    </div>
  );
}
