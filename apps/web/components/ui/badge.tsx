import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "gold" | "purple" | "success" | "danger" | "warning" | "muted" | "live";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

/**
 * Status/label badge. Variants map directly to VR design tokens.
 * - gold:    primary accent — PUBLISHED, VIP, Featured
 * - purple:  secondary accent — SERIES, Multi-layer
 * - success: green — CHECKED_IN, VERIFIED, ACTIVE
 * - danger:  red — CANCELLED, EXPIRED, DENIED
 * - warning: amber — PENDING, DRAFT
 * - live:    gold with pulse dot — currently happening events
 * - muted:   dim text on dark bg — PAST, INACTIVE
 */
export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",

        variant === "default" && "bg-vr-surface text-vr-text border border-vr-border",
        variant === "gold"    && "bg-vr-gold/15 text-vr-gold border border-vr-gold/30",
        variant === "purple"  && "bg-vr-purple/15 text-vr-purple-lt border border-vr-purple/30",
        variant === "success" && "bg-vr-success/15 text-vr-success border border-vr-success/30",
        variant === "danger"  && "bg-vr-danger/15 text-vr-danger border border-vr-danger/30",
        variant === "warning" && "bg-vr-warning/15 text-vr-warning border border-vr-warning/30",
        variant === "muted"   && "bg-vr-surface text-vr-muted border border-vr-border",

        variant === "live" && [
          "bg-vr-gold/15 text-vr-gold border border-vr-gold/30",
          "before:inline-block before:size-1.5 before:rounded-full before:bg-vr-gold before:animate-live-pulse"
        ],

        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Maps an event status string to the correct Badge variant. */
export function EventStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    DRAFT:      "warning",
    PUBLISHED:  "gold",
    LIVE:       "live",
    COMPLETED:  "muted",
    CANCELLED:  "danger"
  };
  return <Badge variant={map[status] ?? "default"}>{status}</Badge>;
}
