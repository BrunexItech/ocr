"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/api";
import { FileWarning } from "lucide-react";

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
      <div className={`flex items-center justify-center bg-white/10 text-blue-100/50 ${className || ""}`}>
        <FileWarning className="w-8 h-8" strokeWidth={1.5} />
      </div>
    );
  }
  if (!src) {
    return <div className={`animate-pulse bg-white/10 ${className || ""}`} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Document preview" className={`${fit === "contain" ? "object-contain" : "object-cover"} ${className || ""}`} />;
}
