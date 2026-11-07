"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Spinner from "@/components/Spinner";
import { ScanLine, CheckCircle2, IdCard } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
          <h1 className="text-4xl font-semibold leading-tight mb-5">Scan it.<br />Read it.<br />Trust it.</h1>
          <p className="text-emerald-50/80 text-lg leading-relaxed mb-12">
            Point a camera at any document and get accurate, structured data back in seconds.
          </p>

          {/* One clean, uncluttered scan-result mockup */}
          <div className="bg-white/[0.07] backdrop-blur-sm border border-white/15 rounded-2xl p-6 shadow-2xl card-float">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-14 rounded-lg bg-gradient-to-br from-white/25 to-white/5 border border-white/20 flex-shrink-0 flex items-center justify-center">
                <IdCard className="w-5 h-5 text-white/80" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">National ID</p>
                <p className="text-xs text-emerald-50/60">Scanned just now</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-400/20 text-emerald-200 rounded-full px-2.5 py-1 flex-shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                98%
              </span>
            </div>
            <div className="space-y-2.5">
              {[
                ["Full name", "J. Mwangi"],
                ["Date of birth", "1994-02-11"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-emerald-50/55">{label}</span>
                  <span className="font-medium text-white">{value}</span>
                </div>
              ))}
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
