// Lazily loads OpenCV.js (only when the live scanner is actually opened) so it never
// weighs down any other page. Declares the global `cv` object once ready.
declare global {
  interface Window {
    cv: OpenCVNamespace;
  }
}

// Minimal surface we actually use - OpenCV.js's own types aren't published on npm.
// NOTE: OpenCV.js is a direct Embind/WASM binding, not idiomatic JS - functions do NOT
// have default parameter values at the binding layer even where the C++ API has them,
// so every call site below passes every parameter explicitly (matching OpenCV.js's own
// published samples) rather than relying on JS-style optional args.
type MatCtor = {
  new (...args: unknown[]): OpenCVMat;
  ones: (rows: number, cols: number, type: number) => OpenCVMat;
};

export type OpenCVNamespace = {
  onRuntimeInitialized?: () => void;
  Mat: MatCtor;
  MatVector: new () => OpenCVMatVector;
  Size: new (w: number, h: number) => unknown;
  Point: new (x: number, y: number) => unknown;
  imread: (canvas: HTMLCanvasElement) => OpenCVMat;
  cvtColor: (src: OpenCVMat, dst: OpenCVMat, code: number) => void;
  GaussianBlur: (src: OpenCVMat, dst: OpenCVMat, size: unknown, sigma: number) => void;
  Canny: (src: OpenCVMat, dst: OpenCVMat, t1: number, t2: number) => void;
  dilate: (
    src: OpenCVMat,
    dst: OpenCVMat,
    kernel: OpenCVMat,
    anchor: unknown,
    iterations: number,
    borderType: number,
    borderValue: unknown
  ) => void;
  morphologyDefaultBorderValue: () => unknown;
  findContours: (src: OpenCVMat, contours: OpenCVMatVector, hierarchy: OpenCVMat, mode: number, method: number) => void;
  contourArea: (cnt: OpenCVMat) => number;
  arcLength: (cnt: OpenCVMat, closed: boolean) => number;
  approxPolyDP: (cnt: OpenCVMat, approx: OpenCVMat, epsilon: number, closed: boolean) => void;
  getPerspectiveTransform: (src: OpenCVMat, dst: OpenCVMat) => OpenCVMat;
  warpPerspective: (src: OpenCVMat, dst: OpenCVMat, m: OpenCVMat, size: unknown) => void;
  matFromArray: (rows: number, cols: number, type: number, arr: number[]) => OpenCVMat;
  imshow: (canvas: HTMLCanvasElement, mat: OpenCVMat) => void;
  COLOR_RGBA2GRAY: number;
  RETR_LIST: number;
  CHAIN_APPROX_SIMPLE: number;
  BORDER_CONSTANT: number;
  CV_8U: number;
  CV_8UC1: number;
  CV_32FC2: number;
};

type OpenCVMat = {
  delete: () => void;
  rows: number;
  cols: number;
  data32S: Int32Array;
  size: () => { width: number; height: number };
};
type OpenCVMatVector = {
  size: () => number;
  get: (i: number) => OpenCVMat;
  delete: () => void;
};

let loadPromise: Promise<OpenCVNamespace> | null = null;
let cachedScriptText: string | null = null;

const STALL_TIMEOUT_MS = 15000; // abort if no new data arrives for this long
const WASM_INIT_GRACE_MS = 45000; // WASM compile/instantiate can be slow on phones

export type LoadProgress = { phase: "downloading" | "initializing"; pct: number | null };

export function loadOpenCV(onProgress?: (p: LoadProgress) => void): Promise<OpenCVNamespace> {
  if (loadPromise) return loadPromise;
  loadPromise = run(onProgress).catch((err) => {
    loadPromise = null; // allow retrying on the next call rather than caching a failure forever
    throw err;
  });
  return loadPromise;
}

async function run(onProgress?: (p: LoadProgress) => void): Promise<OpenCVNamespace> {
  if (typeof window !== "undefined" && window.cv && window.cv.Mat) {
    return window.cv;
  }

  const scriptText = cachedScriptText ?? (await downloadWithStallDetection(onProgress));
  cachedScriptText = scriptText;

  onProgress?.({ phase: "initializing", pct: null });

  return new Promise<OpenCVNamespace>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("The scanner engine loaded but took too long to start - your device may be too slow for this, use the capture button instead"));
    }, WASM_INIT_GRACE_MS);

    // OpenCV.js's WASM init runs as soon as the script executes, and only calls
    // onRuntimeInitialized if it's ALREADY set on `cv` (or `Module`) at that moment -
    // registering it after script.onload fires is too late and the signal can be missed.
    // So this must be in place BEFORE the script is injected/executed.
    window.cv = ({
      onRuntimeInitialized: () => {
        clearTimeout(timer);
        resolve(window.cv);
      },
    } as unknown) as OpenCVNamespace;

    try {
      const script = document.createElement("script");
      script.text = scriptText;
      document.head.appendChild(script);
    } catch (err) {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error("Could not start the scanner engine"));
    }
  });
}

async function downloadWithStallDetection(onProgress?: (p: LoadProgress) => void): Promise<string> {
  const controller = new AbortController();

  const res = await fetch("/opencv.js", { signal: controller.signal }).catch(() => {
    throw new Error("Could not reach the server to load the scanner engine - check your connection");
  });
  if (!res.ok || !res.body) {
    throw new Error(`Could not load the scanner engine (server returned ${res.status})`);
  }

  const total = Number(res.headers.get("content-length")) || null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  // A single reject function, captured once, that both the initial arm() and every
  // subsequent re-arm (on each chunk received) call into - this is what makes the
  // timeout "stall-based" (resets on progress) rather than a flat deadline.
  let stallTimer: ReturnType<typeof setTimeout> = setTimeout(() => {}, 0);
  let rejectStall!: (err: Error) => void;
  const stalled = new Promise<never>((_, reject) => {
    rejectStall = reject;
  });
  const arm = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      controller.abort();
      rejectStall(new Error("The scanner engine download stalled - check your connection and try again"));
    }, STALL_TIMEOUT_MS);
  };

  const readLoop = (async () => {
    arm();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        arm();
        onProgress?.({ phase: "downloading", pct: total ? Math.round((received / total) * 100) : null });
      }
    }
    clearTimeout(stallTimer);
  })();
  readLoop.catch(() => {
    /* if this rejects (e.g. abort), `stalled` already reflects the real error via the
       race below - this catch only exists to avoid an unhandled-rejection console warning */
  });

  await Promise.race([readLoop, stalled]);

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8").decode(combined);
}
