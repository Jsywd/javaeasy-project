import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  return (
    <button
      id="theme-toggle-btn"
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all cursor-pointer bg-white hover:bg-slate-100 text-indigo-600 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-amber-400 dark:border-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95"
      aria-label="Toggle dark/light mode"
      title={theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง (Light Mode)" : "เปลี่ยนเป็นโหมดมืด (Dark Mode)"}
    >
      {theme === "dark" ? (
        <Sun size={18} className="text-amber-400 hover:rotate-45 transition-transform" />
      ) : (
        <Moon size={18} className="text-indigo-600 hover:-rotate-12 transition-transform" />
      )}
    </button>
  );
}
