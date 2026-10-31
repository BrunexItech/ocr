"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import Spinner from "@/components/Spinner";

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
      <div className="hidden lg:flex flex-col justify-between brand-grad text-white p-12">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3" /></svg>
          </span>
          Oqtekal OCR
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight mb-3">Scan it. Read it. Trust it.</h1>
          <p className="text-emerald-50/90 max-w-md">
            Point a camera at any document and get accurate, structured data back in seconds — invoices,
            receipts, IDs, passports, and anything else you teach it to recognise.
          </p>
        </div>
        <p className="text-xs text-emerald-50/70">Open-source · self-hosted · no data leaves your server</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-6 flex items-center gap-2 font-semibold text-lg text-emerald-700">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3" /></svg>
            </span>
            Oqtekal OCR
          </div>
          <h2 className="text-xl font-semibold mb-1">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-6">Sign in to start scanning.</p>
          <form onSubmit={onSubmit} className="space-y-4 bg-white border border-slate-200 rounded-2xl p-6 card-float">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {busy && <Spinner className="w-4 h-4" light />}
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="text-sm text-slate-500 mt-5 text-center">
            Setting this up for the first time?{" "}
            <Link href="/register" className="text-emerald-700 font-medium">
              Create the admin account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
