import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Velvet Rope design tokens — structural colors use CSS vars so the
        // theme toggle works. Gold/purple/status colors stay fixed across themes.
        vr: {
          // Structural (change with theme) — defined as RGB channels in globals.css
          black:       "rgb(var(--vr-black) / <alpha-value>)",
          surface:     "rgb(var(--vr-surface) / <alpha-value>)",
          card:        "rgb(var(--vr-card) / <alpha-value>)",
          border:      "rgb(var(--vr-border) / <alpha-value>)",
          text:        "var(--vr-text)",
          muted:       "var(--vr-muted)",
          // Fixed (same in dark and light)
          gold:        "#f97316",
          "gold-lt":   "#fb923c",
          purple:      "#6B4FA0",
          "purple-lt": "#9B7FD4",
          success:     "#22C55E",
          danger:      "#EF4444",
          warning:     "#F59E0B"
        },
        // Semantic aliases that map to VR tokens (used by shadcn-compatible code)
        background:           "var(--background)",
        foreground:           "var(--foreground)",
        card:                 "var(--card)",
        "card-foreground":    "var(--card-foreground)",
        border:               "var(--border)",
        input:                "var(--input)",
        primary:              "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        muted:                "var(--muted)",
        "muted-foreground":   "var(--muted-foreground)",
        accent:               "var(--accent)",
        "accent-foreground":  "var(--accent-foreground)",
        destructive:          "var(--destructive)"
      },
      boxShadow: {
        soft:      "0 4px 24px rgba(0,0,0,0.45)",
        gold:      "0 0 16px rgba(249,115,22,0.25)",
        "gold-lg": "0 0 32px rgba(249,115,22,0.35)"
      },
      backgroundImage: {
        "gold-gradient":   "linear-gradient(135deg, #f97316, #fb923c)",
        "purple-gradient": "linear-gradient(135deg, #6B4FA0, #9B7FD4)",
        "vr-hero":         "linear-gradient(180deg, #0A0A0F 0%, #12121A 100%)"
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" }
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        livebar: {
          "from": { width: "0%" },
          "to":   { width: "100%" }
        }
      },
      animation: {
        pulse:     "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer:   "shimmer 1.8s linear infinite",
        "fade-in": "fade-in 0.3s ease-out",
        livebar:   "livebar 2s ease-in-out forwards"
      }
    }
  },
  plugins: []
} satisfies Config;
