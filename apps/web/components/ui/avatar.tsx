import Image from "next/image";
import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg" | "xl";

type AvatarProps = {
  name?:     string;
  imageUrl?: string;
  size?:     AvatarSize;
  className?: string;
};

/** Deterministic hue from a name string — same name always gets the same color. */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

const sizeMap: Record<AvatarSize, string> = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-xl"
};

/**
 * Circular avatar. Shows image when provided, otherwise renders
 * the first two initials of name on a deterministic background color.
 */
export function Avatar({ name = "", imageUrl, size = "md", className }: AvatarProps) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const hue = nameToHue(name);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full overflow-hidden font-semibold",
        sizeMap[size],
        className
      )}
      style={!imageUrl ? { backgroundColor: `hsl(${hue},35%,28%)`, color: `hsl(${hue},70%,70%)` } : undefined}
      aria-label={name}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill className="object-cover" />
      ) : (
        <span>{initials || "?"}</span>
      )}
    </div>
  );
}
