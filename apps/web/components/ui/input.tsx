import * as React from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?:   string;
  error?:   string;
  hint?:    string;
  /** Lucide icon component rendered on the left inside the input */
  leftIcon?: React.ElementType;
};

/**
 * Velvet Rope text input.
 * Renders label above, optional left icon, and error/hint text below.
 * Dark surface background with gold focus ring.
 */
export function Input({ label, error, hint, leftIcon: LeftIcon, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-vr-text">
          {label}
        </label>
      )}
      <div className="relative">
        {LeftIcon && (
          <LeftIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-vr-muted" />
        )}
        <input
          id={inputId}
          className={cn(
            "h-11 w-full rounded-lg border bg-vr-surface text-vr-text",
            "placeholder:text-vr-muted",
            "transition-colors outline-none",
            "focus:border-vr-gold focus:ring-1 focus:ring-vr-gold",
            LeftIcon ? "pl-10 pr-4" : "px-4",
            error ? "border-vr-danger" : "border-vr-border",
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-vr-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-vr-muted">{hint}</p>}
    </div>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?:  string;
};

/**
 * Multi-line variant of Input, same styling rules.
 */
export function Textarea({ label, error, hint, className, id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-vr-text">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={cn(
          "min-h-28 w-full rounded-lg border bg-vr-surface px-4 py-3",
          "text-sm text-vr-text placeholder:text-vr-muted",
          "transition-colors outline-none resize-y",
          "focus:border-vr-gold focus:ring-1 focus:ring-vr-gold",
          error ? "border-vr-danger" : "border-vr-border",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-vr-danger">{error}</p>}
      {hint && !error && <p className="text-xs text-vr-muted">{hint}</p>}
    </div>
  );
}
