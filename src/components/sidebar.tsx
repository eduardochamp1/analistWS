"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CloudSun, Users, Menu, X, LayoutDashboard, BarChart2,
  ChevronLeft, ChevronRight, Moon, Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { EngelmigLogoFull, EngelmigLogo } from "./engelmig-logo";
import { useSidebar } from "@/contexts/SidebarContext";
import { useDarkMode } from "@/contexts/DarkModeContext";

const navItems = [
  { label: "Inicio",            href: "/",       icon: LayoutDashboard },
  { label: "Previsao do Tempo", href: "/weather", icon: CloudSun },
  { label: "Gestão de Equipes", href: "/gestao",  icon: Users },
  { label: "BI's Engelmig",     href: "/bi",      icon: BarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { collapsed, toggle } = useSidebar();
  const { dark, toggle: toggleDark } = useDarkMode();

  // Detect mobile breakpoint (md = 768px)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileOpen(false); // close drawer when going to desktop
    };
    setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // No mobile, sidebar never collapses — always shows full width when open
  const isCollapsed = isMobile ? false : collapsed;

  return (
    <>
      {/* ── Botão hamburger — visível só no mobile ── */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg bg-sidebar-bg p-2 text-white md:hidden shadow-lg"
        aria-label="Abrir menu"
      >
        <Menu size={20} />
      </button>

      {/* ── Backdrop mobile ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col bg-sidebar-bg text-sidebar-text transition-all duration-300",
          // Largura: 64px colapsado (desktop only), 256px expandido
          isCollapsed ? "w-16" : "w-64",
          // Mobile: desliza para fora quando fechado
          // Desktop: sempre visível (translate-x-0)
          isMobile
            ? mobileOpen ? "translate-x-0" : "-translate-x-full"
            : "translate-x-0"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center border-b border-white/10 py-4",
            isCollapsed ? "justify-center px-0" : "justify-between px-5"
          )}
        >
          {isCollapsed ? (
            <EngelmigLogo size={28} />
          ) : (
            <EngelmigLogoFull />
          )}

          {/* Botão fechar — mobile */}
          {!isCollapsed && isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="text-sidebar-text"
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="mt-4 flex-1 px-2 overflow-y-auto" aria-label="Menu principal">
          {navItems.map((item) => {
            const isActive =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "mb-1 flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isCollapsed ? "justify-center gap-0" : "gap-3",
                  isActive
                    ? "bg-accent text-sidebar-bg font-semibold"
                    : "hover:bg-white/10"
                )}
              >
                <Icon size={18} className="shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé */}
        <div
          className={cn(
            "mt-auto border-t border-white/10",
            isCollapsed ? "px-2 py-3" : "px-4 py-3"
          )}
        >
          {/* Botão retrair/expandir — desktop only */}
          <button
            onClick={toggle}
            className={cn(
              "hidden md:flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs",
              "text-sidebar-text/60 transition-colors hover:bg-white/10 hover:text-sidebar-text",
              isCollapsed ? "justify-center" : ""
            )}
            aria-label={isCollapsed ? "Expandir menu" : "Retrair menu"}
            title={isCollapsed ? "Expandir menu" : "Retrair menu"}
          >
            {isCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft size={16} />
                <span>Retrair menu</span>
              </>
            )}
          </button>

          {/* Botão Dark Mode */}
          <button
            onClick={toggleDark}
            className={cn(
              "mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs",
              "text-sidebar-text/60 transition-colors hover:bg-white/10 hover:text-sidebar-text",
              isCollapsed ? "justify-center" : ""
            )}
            aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
            title={dark ? "Modo claro" : "Modo escuro"}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            {!isCollapsed && <span>{dark ? "Modo claro" : "Modo escuro"}</span>}
          </button>

          {!isCollapsed && (
            <p className="mt-1 px-2 text-xs text-sidebar-text/40">
              Engelmig Energia v1.0
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
