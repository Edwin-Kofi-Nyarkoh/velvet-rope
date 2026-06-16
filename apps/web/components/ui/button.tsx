import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "gold-outline";
type ButtonSize    = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?:    ButtonSize;
};

/**
 * Core Velvet Rope button. Uses VR design tokens from globals.css.
 * - primary:      gold background, dark text — main CTAs
 * - secondary:    surface border, light text — secondary actions
 * - ghost:        no background — nav items, icon buttons
 * - danger:       red background — destructive actions
 * - gold-outline: transparent with gold border — premium secondary CTA
 */
export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        // Base
        "inline-flex items-center justify-center gap-2 font-medium transition-all",
        "disabled:pointer-events-none disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vr-gold focus-visible:ring-offset-2 focus-visible:ring-offset-vr-black",

        // Sizes
        size === "sm" && "h-8  rounded-md px-3 text-xs",
        size === "md" && "h-10 rounded-lg px-4 text-sm",
        size === "lg" && "h-12 rounded-xl px-6 text-base",

        // Variants
        variant === "primary" &&
          "bg-vr-gold text-vr-black shadow-gold hover:bg-vr-gold-lt active:scale-[0.98]",

        variant === "secondary" &&
          "border border-vr-border bg-vr-card text-vr-text hover:border-vr-gold/40 hover:bg-vr-surface",

        variant === "ghost" &&
          "text-vr-muted hover:bg-vr-surface hover:text-vr-text",

        variant === "danger" &&
          "bg-vr-danger text-white hover:opacity-90 active:scale-[0.98]",

        variant === "gold-outline" &&
          "border border-vr-gold text-vr-gold hover:bg-vr-gold hover:text-vr-black active:scale-[0.98]",

        className
      )}
      {...props}
    />
  );
}
