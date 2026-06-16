import type { ReactNode, ElementType } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type EmptyStateProps = {
  icon?:        ElementType;
  title:        string;
  description?: string;
  action?:      { label: string; onClick?: () => void; href?: string };
  className?:   string;
  children?:    ReactNode;
};

/**
 * Centered empty-state block with optional icon, heading, description,
 * and a CTA button. Renders inside any container that may have no data.
 */
export function EmptyState({ icon: Icon, title, description, action, className, children }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-vr-border",
        "bg-vr-surface/50 px-6 py-12 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-vr-card border border-vr-border">
          <Icon className="size-6 text-vr-muted" />
        </div>
      )}
      <p className="font-semibold text-vr-text">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-vr-muted">{description}</p>
      )}
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button className="mt-5">{action.label}</Button>
          </Link>
        ) : (
          <Button className="mt-5" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
      {children}
    </div>
  );
}

/**
 * Inline error state for query failures.
 */
export function ErrorState({
  message,
  onRetry,
  className
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-vr-danger/30 bg-vr-danger/10 p-6 text-center",
        className
      )}
    >
      <p className="text-sm text-vr-danger">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
