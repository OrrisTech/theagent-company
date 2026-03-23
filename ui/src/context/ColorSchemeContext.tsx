import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ColorScheme = "mono" | "amber" | "blue" | "rose" | "emerald" | "arctic";

interface ColorSchemeContextValue {
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
}

const STORAGE_KEY = "paperclip.colorScheme";
const DEFAULT_SCHEME: ColorScheme = "amber";
const VALID_SCHEMES: ColorScheme[] = ["mono", "amber", "blue", "rose", "emerald", "arctic"];

const ColorSchemeContext = createContext<ColorSchemeContextValue | undefined>(undefined);

function readStoredScheme(): ColorScheme {
  if (typeof window === "undefined") return DEFAULT_SCHEME;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_SCHEMES.includes(stored as ColorScheme)) {
      return stored as ColorScheme;
    }
  } catch {
    // Ignore
  }
  return DEFAULT_SCHEME;
}

function applyScheme(scheme: ColorScheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Remove all scheme classes
  for (const s of VALID_SCHEMES) {
    root.classList.remove(`scheme-${s}`);
  }
  // Mono = no class (uses default CSS values)
  if (scheme !== "mono") {
    root.classList.add(`scheme-${scheme}`);
  }
}

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(() => readStoredScheme());

  const setScheme = useCallback((s: ColorScheme) => {
    setSchemeState(s);
  }, []);

  useEffect(() => {
    applyScheme(scheme);
    try {
      localStorage.setItem(STORAGE_KEY, scheme);
    } catch {
      // Ignore
    }
  }, [scheme]);

  const value = useMemo(() => ({ scheme, setScheme }), [scheme, setScheme]);

  return (
    <ColorSchemeContext.Provider value={value}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorScheme() {
  const context = useContext(ColorSchemeContext);
  if (!context) {
    throw new Error("useColorScheme must be used within ColorSchemeProvider");
  }
  return context;
}
