"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  setCollapsed: () => {},
  toggle: () => {},
});

function applyCollapsed(v: boolean) {
  if (v) {
    document.documentElement.setAttribute("data-sidebar-collapsed", "true");
  } else {
    document.documentElement.removeAttribute("data-sidebar-collapsed");
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    const v = stored === "true";
    setCollapsedState(v);
    applyCollapsed(v);
  }, []);

  function setCollapsed(v: boolean) {
    setCollapsedState(v);
    applyCollapsed(v);
    localStorage.setItem("sidebar-collapsed", String(v));
  }

  function toggle() {
    setCollapsed(!collapsed);
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
