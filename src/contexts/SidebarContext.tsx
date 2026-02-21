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

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Persiste preferência no localStorage
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsedState(true);
  }, []);

  function setCollapsed(v: boolean) {
    setCollapsedState(v);
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
