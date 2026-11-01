"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Spinner from "@/components/Spinner";

export default function RequireAuth({ roles, children }: { roles?: string[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="w-7 h-7" />
      </div>
    );
  }
  if (!user) return null;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-400 text-sm">
        Your role ({user.role}) can&apos;t open this area.
      </div>
    );
  }
  return <>{children}</>;
}
