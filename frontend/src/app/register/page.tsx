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
    <div className="flex items-center justify-center min-h-[calc(100vh-56px)] p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-1">Create account</h1>
        <p className="text-sm text-zinc-500 mb-6">
          The first account created on a fresh install becomes the administrator automatically.
        </p>
        <form onSubmit={onSubmit} className="space-y-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 card-float">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Full name</label>
            <input className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
            <input className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Password</label>
            <input className="w-full rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 placeholder-zinc-500 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition">
            {busy && <Spinner className="w-4 h-4" light />}
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="text-sm text-zinc-500 mt-5 text-center">
          Already have an account? <Link href="/login" className="text-emerald-400 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
