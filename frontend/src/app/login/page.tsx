"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Spinner from "@/components/Spinner";
import { FileText, User, Lock, Eye, EyeOff, Zap, ShieldCheck, Gauge, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-2 bg-white">
      {/* Hero panel: condensed on mobile (stacked on top), full on desktop (left column) */}
      <div className="flex flex-col justify-center lg:justify-between relative overflow-hidden px-5 py-4 lg:px-16 lg:py-14 bg-gradient-to-br from-[#0a1430] via-[#0d1b3f] to-[#0a2a5e] text-white">
        <div>
          <h1 className="text-lg lg:text-4xl font-bold leading-tight mb-1 lg:mb-3">
            <span className="text-sky-400">OCR</span> Document Processor
          </h1>
          <p className="hidden sm:block lg:block text-sm lg:text-lg text-blue-100/90 mb-1.5 lg:mb-4">Scan &middot; Extract &middot; Verify &middot; Manage</p>
          <div className="w-14 h-1 rounded-full bg-sky-400 mb-1.5 lg:mb-6" />
          <p className="hidden lg:block text-blue-100/70 max-w-sm leading-relaxed">
            Advanced Optical Character Recognition (OCR) system for fast, accurate and secure data extraction.
          </p>
        </div>

        {/* Scanner illustration (CSS/SVG) */}
        <div className="relative lg:flex-1 flex items-center justify-center my-1.5 lg:my-8">
          <div className="relative w-32 lg:w-72">
            {/* scanner head */}
            <div className="h-2.5 lg:h-5 rounded-t-lg bg-gradient-to-b from-zinc-700 to-zinc-900 border border-white/10 relative z-20 mx-3 lg:mx-6">
              <div aria-hidden className="absolute left-1/2 -translate-x-1/2 top-0.5 w-3/4 h-0.5 lg:h-1 rounded-full bg-emerald-400/90 shadow-[0_0_10px_3px_rgba(52,211,153,0.7)]" />
            </div>
            {/* beam: trapezoid, widening downward */}
            <div
              aria-hidden
              className="relative h-10 lg:h-28 mx-auto bg-gradient-to-b from-emerald-400/50 via-emerald-400/15 to-transparent"
              style={{ width: "60%", clipPath: "polygon(35% 0%, 65% 0%, 100% 100%, 0% 100%)" }}
            />
            {/* document, tilted for perspective, with corner brackets */}
            <div className="relative -mt-1 lg:-mt-3 flex flex-col items-center">
              <div className="relative" style={{ transform: "perspective(500px) rotateX(18deg)" }}>
                <span aria-hidden className="absolute -top-1 -left-1 w-2.5 h-2.5 lg:w-4 lg:h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl" />
                <span aria-hidden className="absolute -top-1 -right-1 w-2.5 h-2.5 lg:w-4 lg:h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr" />
                <span aria-hidden className="absolute -bottom-1 -left-1 w-2.5 h-2.5 lg:w-4 lg:h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl" />
                <span aria-hidden className="absolute -bottom-1 -right-1 w-2.5 h-2.5 lg:w-4 lg:h-4 border-b-2 border-r-2 border-emerald-400 rounded-br" />
                <div className="bg-white/95 rounded-lg shadow-2xl p-1.5 lg:p-3 flex gap-1.5 lg:gap-3">
                  <div className="w-6 h-7 lg:w-12 lg:h-14 rounded bg-slate-300 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 lg:w-7 lg:h-7 text-slate-500" />
                  </div>
                  <div className="flex-1 space-y-1 lg:space-y-1.5 py-0.5 lg:py-1">
                    <div className="h-1 lg:h-2 rounded-full bg-slate-300 w-full" />
                    <div className="h-1 lg:h-2 rounded-full bg-slate-300 w-4/5" />
                    <div className="h-1 lg:h-2 rounded-full bg-slate-300 w-3/5" />
                    <div className="h-1 lg:h-2 rounded-full bg-slate-200 w-2/3" />
                  </div>
                </div>
              </div>
              {/* reflection */}
              <div aria-hidden className="w-[85%] h-3 lg:h-6 mt-0.5 lg:mt-1 rounded-full bg-emerald-400/10 blur-md" />
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-6 text-sm text-blue-100/90">
          <span className="inline-flex items-center gap-2"><Zap className="w-4 h-4 text-sky-400" /> High Accuracy</span>
          <span className="w-px h-4 bg-white/15" />
          <span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-sky-400" /> Secure &amp; Reliable</span>
          <span className="w-px h-4 bg-white/15" />
          <span className="inline-flex items-center gap-2"><Gauge className="w-4 h-4 text-sky-400" /> Blazing Fast</span>
        </div>
      </div>

      {/* Right: login card */}
      <div className="flex items-center justify-center relative overflow-hidden px-5 py-4 lg:py-12 bg-white">
        <div aria-hidden className="absolute -top-24 -right-24 w-80 h-80 rounded-[40%] bg-blue-100/70 rotate-12" />
        <div aria-hidden className="absolute -bottom-28 -right-16 w-96 h-96 rounded-[45%] bg-blue-50 -rotate-6" />
        <div aria-hidden className="absolute top-1/3 -right-10 w-40 h-40 rounded-full bg-sky-100/60 blur-xl" />

        <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-xl border border-blue-50 p-5 lg:p-8">
          <div className="flex items-center justify-center gap-2.5 lg:gap-3 mb-3 lg:mb-6">
            <span className="relative w-9 h-9 lg:w-11 lg:h-11 flex items-center justify-center">
              <span className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-blue-500 rounded-tl" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-blue-500 rounded-tr" />
              <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-blue-500 rounded-bl" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-blue-500 rounded-br" />
              <span className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-gradient-to-br from-blue-600 to-sky-400 text-white flex items-center justify-center shadow-md">
                <FileText className="w-4 h-4 lg:w-4.5 lg:h-4.5" />
              </span>
            </span>
            <span className="text-xl lg:text-2xl font-bold text-slate-900">
              OCR <span className="text-blue-600">Pro</span>
            </span>
          </div>

          <h2 className="text-lg lg:text-xl font-bold text-slate-900 text-center mb-1">Welcome Back</h2>
          <p className="text-xs lg:text-sm text-slate-500 text-center mb-3 lg:mb-6">Sign in to access your OCR dashboard</p>

          <form onSubmit={onSubmit} className="space-y-2.5 lg:space-y-4">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 pl-10 pr-3 py-2 lg:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
                type="email"
                placeholder="Username or Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 pl-10 pr-10 py-2 lg:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition"
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
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2 lg:py-2.5 text-sm font-semibold hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition shadow-md"
            >
              {busy ? "Signing in…" : "Sign In"}
              {busy ? <Spinner className="w-4 h-4" light /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="flex items-center gap-3 my-3 lg:my-6">
            <span className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">or</span>
            <span className="flex-1 h-px bg-slate-200" />
          </div>

          <p className="text-xs lg:text-sm text-slate-500 text-center italic">Smarter Document Processing. Greater Productivity.</p>
        </div>
      </div>
    </div>
  );
}
