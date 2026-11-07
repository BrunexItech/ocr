"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Spinner from "@/components/Spinner";
import { ScanLine, IdCard, Receipt, FileText, GraduationCap } from "lucide-react";

const ROTATING = [
  { word: "IDs & passports", Icon: IdCard },
  { word: "invoices & receipts", Icon: Receipt },
  { word: "contracts & forms", Icon: FileText },
  { word: "certificates & records", Icon: GraduationCap },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rotIndex, setRotIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setRotIndex((i) => (i + 1) % ROTATING.length), 2400);
    return () => clearInterval(t);
  }, []);
  const { word: rotWord, Icon: RotIcon } = ROTATING[rotIndex];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-center brand-grad text-white px-16 py-12 relative overflow-hidden">
        <div aria-hidden className="absolute -top-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-white/[0.06] blur-3xl" />

        <div className="flex items-center gap-2 font-semibold text-lg absolute top-12 left-16">
          <span className="w-8 h-8 rounded-lg bg-zinc-900/15 flex items-center justify-center">
            <ScanLine className="w-4.5 h-4.5" />
          </span>
          Oqtekal OCR
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight mb-5">Built to read<br />your documents</h1>
          <p className="text-emerald-50/80 text-lg leading-relaxed mb-3">
            Point a camera at any document and get accurate, structured data back in seconds.
          </p>
          <div key={rotIndex} className="word-rotate flex items-center gap-2 text-emerald-200 font-medium mb-12 h-6">
            <RotIcon className="w-4 h-4" />
            {rotWord}
          </div>

          {/* A single dark document surface, with the scan light confined to it */}
          <div className="relative w-56 aspect-[7/4] rounded-xl bg-zinc-950/70 border border-white/10 shadow-2xl overflow-hidden">
            <div aria-hidden className="scan-sweep absolute left-0 right-0 h-1 bg-emerald-400/80 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)] pointer-events-none" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
              <IdCard className="w-8 h-8" strokeWidth={1.5} />
              <span className="text-xs font-medium tracking-wide">National ID</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-semibold mb-1">Welcome back</h2>
          <p className="text-sm text-zinc-500 mb-6">Sign in to start scanning.</p>
          <form onSubmit={onSubmit} className="space-y-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 card-float">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Password</label>
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {busy && <Spinner className="w-4 h-4" light />}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="text-sm text-zinc-500 mt-5 text-center">
            Setting this up for the first time?{" "}
            <Link href="/register" className="text-emerald-400 font-medium">
              Create the admin account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
