"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/documents" : "/login");
  }, [user, loading, router]);

  return <p className="text-sm text-zinc-500">Loading…</p>;
}
