"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DocThumb({
  docId,
  className,
  fit = "cover",
}: {
  docId: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    const token = getToken();
    fetch(`${API_URL}/api/documents/${docId}/preview?mode=color`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject()))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [docId]);

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className || ""}`}>
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  }
  if (!src) {
    return <div className={`animate-pulse bg-slate-100 ${className || ""}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Document preview" className={`${fit === "contain" ? "object-contain" : "object-cover"} ${className || ""}`} />;
}
