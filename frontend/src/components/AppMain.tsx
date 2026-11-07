"use client";

import { usePathname } from "next/navigation";

export default function AppMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullBleed = pathname?.startsWith("/embed") || pathname === "/login" || pathname === "/register";
  return (
    <main className={fullBleed ? "flex-1 w-full" : "flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-6"}>
      {children}
    </main>
  );
}
