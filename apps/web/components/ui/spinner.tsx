import { cn } from "@/lib/utils";

/**
 * Gold circular loading spinner. Used inside buttons and page-level loading states.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin text-vr-gold", className ?? "size-5")}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
