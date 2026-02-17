"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CloudSun, Route, Users, Menu, X, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import UserMenu from "./user-menu";
import { EngelmigLogoFull } from "./engelmig-logo";

const navItems = [
  {
    label: "Inicio",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Previsao do Tempo",
    href: "/weather",
    icon: CloudSun,
  },
  {
    label: "Rotas",
    href: "/routes",
    icon: Route,
  },
  {
    label: "Gestao de Equipes",
    href: "/teams",
    icon: Users,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-sidebar-bg p-2 text-white md:hidden shadow-lg"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* Backdrop overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-sidebar-bg text-sidebar-text transition-transform duration-300 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <EngelmigLogoFull />
          <button
            onClick={() => setOpen(false)}
            className="text-sidebar-text md:hidden"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-4 flex-1 px-3" aria-label="Menu principal">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-sidebar-bg font-semibold"
                    : "hover:bg-white/10"
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Menu at Bottom */}
        <div className="mt-auto pt-4 border-t border-white/10">
          <UserMenu />
        </div>

        <div className="border-t border-white/10 px-6 py-4 text-xs text-sidebar-text/50">
          Engelmig Energia v1.0
        </div>
      </aside>
    </>
  );
}
