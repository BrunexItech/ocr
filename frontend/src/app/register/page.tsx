"use client";

import { useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Spinner from "@/components/Spinner";

export default function RegisterPage() {
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.register(email, name, password);
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gradient-to-br from-[#0a1430] via-[#0d1b3f] to-[#0a2a5e]">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Create account</h1>
        <p className="text-sm text-slate-500 mb-6">
          The first account created on a fresh install becomes the administrator automatically.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
            <input className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2.5 text-sm font-semibold hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 transition shadow-md">
            {busy && <Spinner className="w-4 h-4" light />}
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-5 text-center">
          Already have an account? <Link href="/login" className="text-blue-600 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
