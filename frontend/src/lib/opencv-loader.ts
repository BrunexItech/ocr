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
const LOAD_TIMEOUT_MS = 20000;

export function loadOpenCV(): Promise<OpenCVNamespace> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.cv && window.cv.Mat) {
      resolve(window.cv);
      return;
    }

    const timer = setTimeout(() => {
      loadPromise = null; // allow a retry on the next call rather than hanging forever
      reject(new Error("The scanner engine took too long to load - check your connection and try again"));
    }, LOAD_TIMEOUT_MS);

    const settle = (fn: () => void) => {
      clearTimeout(timer);
      fn();
    };

    // OpenCV.js's WASM init runs as soon as the script executes, and only calls
    // onRuntimeInitialized if it's ALREADY set on `cv` (or `Module`) at that moment -
    // registering it after script.onload fires is too late and the signal is missed.
    // So we must pre-create the object and attach the callback BEFORE injecting the script.
    window.cv = ({
      onRuntimeInitialized: () => settle(() => resolve(window.cv)),
    } as unknown) as OpenCVNamespace;

    const script = document.createElement("script");
    // Self-hosted (public/opencv.js) rather than an external CDN - removes a real
    // point of failure (third-party reachability, CORS, ad/firewall blocking) for
    // something this feature depends on every time it's used.
    script.src = "/opencv.js";
    script.async = true;
    script.onerror = () => settle(() => reject(new Error("Could not load the scanner engine - check your connection")));
    document.head.appendChild(script);
  });
  return loadPromise;
}
