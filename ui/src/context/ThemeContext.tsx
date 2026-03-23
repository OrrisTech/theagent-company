import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** The user's chosen preference — "system" defers to the OS media query. */
type ThemePreference = "light" | "dark" | "system";
/** The resolved appearance actually applied to the document. */
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** The user's stored preference (light | dark | system). */
  preference: ThemePreference;
  /** The resolved theme actually applied to the document (light | dark). */
  theme: ResolvedTheme;
  /** Set a specific preference. */
  setPreference: (pref: ThemePreference) => void;
  /** Legacy toggle — cycles light → dark → system → light. */
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "tac.theme";
const DARK_THEME_COLOR = "#18181b";
const LIGHT_THEME_COLOR = "#ffffff";
const CYCLE: ThemePreference[] = ["light", "dark", "system"];

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "system") return getSystemTheme();
  return pref;
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Ignore local storage read failures in restricted environments.
  }
  // Fall back to what the document currently has (set by index.html script)
  if (document.documentElement.classList.contains("dark")) return "dark";
  return "light";
}

function applyTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const isDark = resolved === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta instanceof HTMLMetaElement) {
    themeColorMeta.setAttribute("content", isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  // Listen to OS color scheme changes so "system" stays in sync
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const resolved: ResolvedTheme = preference === "system" ? systemTheme : preference;

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreferenceState((current) => {
      const idx = CYCLE.indexOf(current);
      return CYCLE[(idx + 1) % CYCLE.length]!;
    });
  }, []);

  // Apply theme whenever resolved value changes
  useEffect(() => {
    applyTheme(resolved);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, [resolved, preference]);

  const value = useMemo(
    () => ({
      preference,
      theme: resolved,
      setPreference,
      toggleTheme,
    }),
    [preference, resolved, setPreference, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
