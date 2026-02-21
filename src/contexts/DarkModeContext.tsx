"use client";

import { createContext, useContext, useState, useEffect } from "react";

interface DarkModeContextValue {
  dark: boolean;
  setDark: (v: boolean) => void;
  toggle: () => void;
}

const DarkModeContext = createContext<DarkModeContextValue>({
  dark: false,
  setDark: () => {},
  toggle: () => {},
});

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme-dark");
    const enabled = stored === "true";
    setDarkState(enabled);
    if (enabled) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  function setDark(v: boolean) {
    setDarkState(v);
    localStorage.setItem("theme-dark", String(v));
    if (v) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  function toggle() {
    setDark(!dark);
  }

  return (
    <DarkModeContext.Provider value={{ dark, setDark, toggle }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  return useContext(DarkModeContext);
}
