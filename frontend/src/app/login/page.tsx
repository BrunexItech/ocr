"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Spinner from "@/components/Spinner";
import { ScanLine, CheckCircle2, IdCard, Receipt, Layers, Webhook } from "lucide-react";

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
      <div className="hidden lg:flex flex-col justify-between brand-grad text-white p-12 relative overflow-hidden">
        <div aria-hidden className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <div aria-hidden className="absolute bottom-0 -left-20 w-72 h-72 rounded-full bg-black/10 blur-3xl" />

        <div className="flex items-center gap-2 font-semibold text-lg relative z-10">
          <span className="w-8 h-8 rounded-lg bg-zinc-900/15 flex items-center justify-center">
            <ScanLine className="w-4.5 h-4.5" />
          </span>
          Oqtekal OCR
        </div>

        <div className="relative z-10">
          <h1 className="text-3xl font-semibold leading-tight mb-3">Scan it. Read it. Trust it.</h1>
          <p className="text-emerald-50/90 max-w-md mb-8">
            Point a camera at any document and get accurate, structured data back in seconds — invoices,
            receipts, IDs, passports, and anything else you teach it to recognise.
          </p>

          {/* Live-looking scan result mockup */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4 shadow-xl max-w-sm card-float">
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-400/20 text-emerald-200 rounded-full px-2.5 py-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Approved
              </span>
              <span className="text-xs text-emerald-50/70 font-mono">98% confidence</span>
            </div>
            <div className="flex gap-3">
              <div className="w-16 h-20 rounded-lg bg-gradient-to-br from-white/25 to-white/5 border border-white/20 flex-shrink-0 flex items-center justify-center">
                <IdCard className="w-6 h-6 text-white/70" />
              </div>
              <div className="flex-1 space-y-1.5">
                {[
                  ["Full name", "J. Mwangi"],
                  ["ID number", "3754178••"],
                  ["Date of birth", "1994-02-11"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-xs bg-black/15 rounded-md px-2.5 py-1.5">
                    <span className="text-emerald-50/60">{label}</span>
                    <span className="font-medium text-white">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            {[
              { Icon: IdCard, label: "IDs & passports" },
              { Icon: Receipt, label: "Invoices & receipts" },
              { Icon: Layers, label: "Multi-page scans" },
              { Icon: Webhook, label: "API & embeddable widget" },
            ].map(({ Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-xs text-emerald-50/80 bg-white/10 border border-white/10 rounded-full px-3 py-1.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <p className="text-xs text-emerald-50/70 relative z-10">Secure, private infrastructure — your data stays under your control</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-6 flex items-center gap-2 font-semibold text-lg text-emerald-400">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <ScanLine className="w-4.5 h-4.5" />
            </span>
            Oqtekal OCR
          </div>
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
