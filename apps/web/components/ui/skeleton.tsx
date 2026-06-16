import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Shimmer loading placeholder that uses the VR dark card background.
 * Drop-in replacement for any content area while data is loading.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-vr-card",
        "before:absolute before:inset-0",
        "before:bg-[linear-gradient(90deg,transparent_0%,rgba(201,168,76,0.06)_50%,transparent_100%)]",
        "before:bg-[length:200%_100%] before:animate-shimmer",
        className
      )}
      {...props}
    />
  );
}
