"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldUseDark = saved ? saved === "dark" : prefersDark;

    window.setTimeout(() => {
      setDark(shouldUseDark);
      setMounted(true);
    }, 0);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex h-16 items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left text-slate-900 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
      aria-label="Cambiar modo"
      title="Cambiar modo"
    >
      <span>
        <span className="block text-lg font-black">Modo oscuro</span>
        <span className="block text-sm font-bold text-slate-500 dark:text-slate-400">
          {mounted && dark ? "Activado" : "Desactivado"}
        </span>
      </span>
      {mounted && dark ? (
        <Sun className="h-7 w-7" />
      ) : (
        <Moon className="h-7 w-7" />
      )}
    </button>
  );
}
