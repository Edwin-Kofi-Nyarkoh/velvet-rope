export type ThemeMode = "light" | "dark" | "system";

export type AppTheme = {
  dark: boolean;
  colors: {
    gold:     string;
    ink:      string;
    slate:    string;
    line:     string;
    surface:  string;
    card:     string;
    muted:    string;
    elevated: string;
    danger:   string;
    success:  string;
    purple:   string;
  };
};

export const lightTheme: AppTheme = {
  dark: false,
  colors: {
    gold:     "#f97316",
    ink:      "#111827",
    slate:    "#4b5563",
    line:     "#e2dff5",
    surface:  "#f5f3ff",
    card:     "#ffffff",
    muted:    "#f0edf9",
    elevated: "#ffffff",
    danger:   "#b91c1c",
    success:  "#16a34a",
    purple:   "#6B4FA0"
  }
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: {
    gold:     "#f97316",
    ink:      "#F0EEF8",
    slate:    "#8A8AA8",
    line:     "#2E2E4A",
    surface:  "#0A0A0F",
    card:     "#1C1C2E",
    muted:    "#12121A",
    elevated: "#1C1C2E",
    danger:   "#EF4444",
    success:  "#22C55E",
    purple:   "#6B4FA0"
  }
};

export function getTheme(mode: ThemeMode, systemDark: boolean) {
  return mode === "dark" || (mode === "system" && systemDark) ? darkTheme : lightTheme;
}
