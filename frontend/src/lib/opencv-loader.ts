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

export function loadOpenCV(): Promise<OpenCVNamespace> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.cv && window.cv.Mat) {
      resolve(window.cv);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.9.0/opencv.js";
    script.async = true;
    script.onerror = () => reject(new Error("Could not load the scanner engine - check your connection"));
    script.onload = () => {
      const cv = window.cv as unknown as OpenCVNamespace & { then?: (cb: () => void) => void };
      const finish = () => resolve(window.cv);
      if (cv.Mat) finish();
      else cv.onRuntimeInitialized = finish;
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}
