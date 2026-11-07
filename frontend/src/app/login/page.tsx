"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Spinner from "@/components/Spinner";
import { ScanLine, User, Lock, Eye, EyeOff, Zap, ShieldCheck, Gauge, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left: illustrated panel */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden px-16 py-14 bg-gradient-to-br from-[#0a1430] via-[#0d1b3f] to-[#0a2a5e] text-white">
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-3">
            <span className="text-sky-400">OCR</span> Document Processor
          </h1>
          <p className="text-lg text-blue-100/90 mb-4">Scan &middot; Extract &middot; Verify &middot; Manage</p>
          <div className="w-14 h-1 rounded-full bg-sky-400 mb-6" />
          <p className="text-blue-100/70 max-w-sm leading-relaxed">
            Advanced Optical Character Recognition (OCR) system for fast, accurate and secure data extraction.
          </p>
        </div>

        {/* Scanner illustration (CSS/SVG) */}
        <div className="relative flex-1 flex items-center justify-center my-8">
          <div className="relative w-72">
            {/* scanner head */}
            <div className="h-5 rounded-t-lg bg-gradient-to-b from-zinc-700 to-zinc-900 border border-white/10 relative z-20 mx-6">
              <div aria-hidden className="absolute left-1/2 -translate-x-1/2 top-1 w-3/4 h-1 rounded-full bg-emerald-400/90 shadow-[0_0_10px_3px_rgba(52,211,153,0.7)]" />
            </div>
            {/* beam */}
            <div aria-hidden className="relative h-24 mx-10 bg-gradient-to-b from-emerald-400/40 via-emerald-400/10 to-transparent" />
            {/* document with corner brackets */}
            <div className="relative -mt-2">
              <span aria-hidden className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
              <span aria-hidden className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
              <span aria-hidden className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
              <span aria-hidden className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br" />
              <div className="bg-white/95 rounded-lg shadow-2xl p-3 flex gap-3">
                <div className="w-12 h-14 rounded bg-slate-300 flex items-center justify-center flex-shrink-0">
                  <User className="w-7 h-7 text-slate-500" />
                </div>
                <div className="flex-1 space-y-1.5 py-1">
                  <div className="h-2 rounded-full bg-slate-300 w-full" />
                  <div className="h-2 rounded-full bg-slate-300 w-4/5" />
                  <div className="h-2 rounded-full bg-slate-300 w-3/5" />
                  <div className="h-2 rounded-full bg-slate-200 w-2/3" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-blue-100/90">
          <span className="inline-flex items-center gap-2"><Zap className="w-4 h-4 text-sky-400" /> High Accuracy</span>
          <span className="w-px h-4 bg-white/15" />
          <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-sky-400" /> Secure &amp; Reliable</span>
          <span className="w-px h-4 bg-white/15" />
          <span className="inline-flex items-center gap-2"><Gauge className="w-4 h-4 text-sky-400" /> Blazing Fast</span>
        </div>
      </div>

      {/* Right: login card */}
      <div className="flex items-center justify-center relative overflow-hidden px-6 py-12 bg-white">
        <div aria-hidden className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-blue-50 blur-2xl" />
        <div aria-hidden className="absolute -bottom-20 -right-10 w-80 h-80 rounded-full bg-blue-50 blur-2xl" />

        <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-xl border border-blue-50 p-8">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white flex items-center justify-center shadow-md">
              <ScanLine className="w-6 h-6" />
            </span>
            <span className="text-2xl font-bold text-slate-900">
              OCR <span className="text-blue-600">Pro</span>
            </span>
          </div>

          <h2 className="text-xl font-bold text-slate-900 text-center mb-1">Welcome Back</h2>
          <p className="text-sm text-slate-500 text-center mb-6">Sign in to access your OCR dashboard</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                type="email"
                placeholder="Username or Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
              </button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2.5 text-sm font-semibold hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition shadow-md"
            >
              {busy ? <Spinner className="w-4 h-4" light /> : <ArrowRight className="w-4 h-4" />}
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <span className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <p className="text-sm text-slate-500 text-center italic mb-4">Smarter Document Processing. Greater Productivity.</p>

          <p className="text-sm text-slate-500 text-center">
            Setting this up for the first time?{" "}
            <Link href="/register" className="text-blue-600 font-medium not-italic">
              Create the admin account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
