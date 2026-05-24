"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const storageKey = "allo-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(storageKey, theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const rootTheme = document.documentElement.dataset.theme;
    if (rootTheme === "dark" || rootTheme === "light") {
      setTheme(rootTheme);
    }
    setMounted(true);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      aria-label={
        mounted
          ? `Switch to ${nextTheme} mode`
          : "Toggle between light and dark mode"
      }
      className="theme-toggle-shadow inline-flex shrink-0 items-center gap-0.5 rounded-full border border-app-soft bg-app-veil p-0.5 text-xs text-app-muted transition hover:border-app-strong hover:text-[var(--foreground)] sm:gap-1"
      onClick={() => {
        const updatedTheme = theme === "dark" ? "light" : "dark";
        setTheme(updatedTheme);
        applyTheme(updatedTheme);
      }}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition sm:px-3",
          theme === "light"
            ? "bg-[var(--surface-strong)] text-[var(--foreground)] shadow-sm"
            : "text-app-soft",
        )}
      >
        <SunMedium className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Light</span>
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition sm:px-3",
          theme === "dark"
            ? "bg-[var(--surface-strong)] text-[var(--foreground)] shadow-sm"
            : "text-app-soft",
        )}
      >
        <MoonStar className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Dark</span>
      </span>
    </button>
  );
}
