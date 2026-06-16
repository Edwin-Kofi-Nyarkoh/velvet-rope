import * as React from "react";
import { cn } from "@/lib/utils";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** When true, adds a gold border glow on hover */
  glow?: boolean;
};

/**
 * Velvet Rope surface card. Background: vr-card (#1C1C2E), border: vr-border.
 * Pass glow=true for the premium hover effect on interactive cards.
 */
export function Card({ className, glow = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-vr-border bg-vr-card p-5 transition-all duration-200",
        glow && "cursor-pointer hover:border-vr-gold/60 hover:shadow-gold",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-semibold text-vr-text", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-vr-muted", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4 flex items-center gap-3 border-t border-vr-border pt-4", className)} {...props} />;
}
