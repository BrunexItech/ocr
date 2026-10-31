"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const LINKS = [
  { href: "/documents", label: "Documents", roles: ["admin", "approver", "reviewer", "intake", "viewer"] },
  { href: "/intake", label: "Intake", roles: ["admin", "intake"] },
  { href: "/admin/types", label: "Document types", roles: ["admin"] },
  { href: "/admin/users", label: "Users", roles: ["admin"] },
  { href: "/admin/integrations", label: "Integrations", roles: ["admin"] },
  { href: "/admin/audit", label: "Audit trail", roles: ["admin", "approver"] },
];

export default function NavBar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (loading) return null;
  const links = user ? LINKS.filter((l) => l.roles.includes(user.role)) : [];

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4 sm:gap-6">
        <Link href="/documents" className="font-semibold text-emerald-700 tracking-tight whitespace-nowrap">
          Oqtekal <span className="text-slate-400 font-normal">OCR</span>
        </Link>

        {/* Desktop nav */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                  pathname?.startsWith(l.href) ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="hidden md:flex items-center gap-3 ml-auto">
          {user ? (
            <>
              <span className="text-sm text-slate-500 whitespace-nowrap">
                {user.name} · <span className="uppercase text-xs font-semibold text-emerald-700">{user.role}</span>
              </span>
              <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm font-medium text-emerald-700">
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden ml-auto p-2 -mr-2 rounded-md text-slate-600 hover:bg-slate-100"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {user ? (
            <>
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm font-medium ${
                    pathname?.startsWith(l.href) ? "bg-emerald-50 text-emerald-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between px-3">
                <span className="text-sm text-slate-500">
                  {user.name} · <span className="uppercase text-xs font-semibold text-emerald-700">{user.role}</span>
                </span>
                <button onClick={() => { setOpen(false); logout(); }} className="text-sm font-medium text-slate-500">
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm font-medium text-emerald-700">
              Sign in
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
