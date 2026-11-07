"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  ScanLine,
  FileText,
  Camera,
  Layers,
  Users,
  Plug,
  KeyRound,
  Crop,
  History,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const LINKS = [
  { href: "/documents", label: "Documents", icon: FileText, roles: ["admin", "approver", "reviewer", "intake", "viewer"] },
  { href: "/intake", label: "Scan & Upload", icon: Camera, roles: ["admin", "intake"] },
];

const ADMIN_LINKS = [
  { href: "/admin/types", label: "Document types", icon: Layers, roles: ["admin"] },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["admin"] },
  { href: "/admin/integrations", label: "Integrations", icon: Plug, roles: ["admin"] },
  { href: "/admin/service-accounts", label: "Service accounts", icon: KeyRound, roles: ["admin"] },
  { href: "/admin/zone-tool", label: "Zone template tool", icon: Crop, roles: ["admin"] },
  { href: "/admin/audit", label: "Activity log", icon: History, roles: ["admin", "approver"] },
];

function NavLink({ href, label, icon: Icon, active, onClick }: { href: string; label: string; icon: typeof FileText; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
        active ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-900/40" : "text-blue-100/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      <Icon className="w-4.5 h-4.5 flex-shrink-0" />
      {label}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const links = user ? LINKS.filter((l) => l.roles.includes(user.role)) : [];
  const adminLinks = user ? ADMIN_LINKS.filter((l) => l.roles.includes(user.role)) : [];

  return (
    <div className="flex flex-col h-full">
      <Link href="/documents" className="flex items-center gap-2.5 px-5 py-6" onClick={onNavigate}>
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white flex items-center justify-center shadow-md">
          <ScanLine className="w-5 h-5" />
        </span>
        <span>
          <span className="block text-base font-bold text-white leading-tight">OCR</span>
          <span className="block text-[11px] text-blue-200/60 leading-tight">Document Processor</span>
        </span>
      </Link>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto no-scrollbar">
        {links.map((l) => (
          <NavLink key={l.href} href={l.href} label={l.label} icon={l.icon} active={pathname?.startsWith(l.href) || false} onClick={onNavigate} />
        ))}

        {adminLinks.length > 0 && (
          <>
            <p className="px-3.5 pt-4 pb-1 text-[11px] font-semibold text-blue-200/40 uppercase tracking-wide">Admin</p>
            {adminLinks.map((l) => (
              <NavLink key={l.href} href={l.href} label={l.label} icon={l.icon} active={pathname?.startsWith(l.href) || false} onClick={onNavigate} />
            ))}
          </>
        )}
      </nav>

      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 px-3.5 py-2 mb-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="leading-tight">
            <p className="text-xs font-medium text-emerald-300">System Online</p>
            <p className="text-[10px] text-emerald-400/60">All services running</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-sky-400 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user.name?.slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-[11px] text-blue-200/50 uppercase tracking-wide">{user.role}</p>
            </div>
            <button onClick={logout} className="text-blue-200/50 hover:text-white transition p-1.5" aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (loading) return null;
  if (pathname?.startsWith("/embed")) return null;
  if (pathname === "/login" || pathname === "/register") return null;
  if (!user) return null;

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 h-14 bg-[#0a1430] border-b border-white/10">
        <Link href="/documents" className="flex items-center gap-2 font-semibold text-white">
          <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center">
            <ScanLine className="w-4 h-4" />
          </span>
          OCR <span className="text-blue-200/60 font-normal">Pro</span>
        </Link>
        <button onClick={() => setOpen(true)} className="p-2 text-blue-100/70 hover:text-white" aria-label="Open menu">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-[#0a1430] border-r border-white/10 h-full">
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-blue-100/70 hover:text-white" aria-label="Close menu">
              <X className="w-5 h-5" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 bg-[#0a1430] border-r border-white/10 h-screen sticky top-0">
        <SidebarContent />
      </aside>
    </>
  );
}
