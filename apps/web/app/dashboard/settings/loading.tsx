import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-2xl rounded-xl border border-vr-border bg-vr-card p-5 shadow-soft">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-5 h-11 w-full" />
      <Skeleton className="mt-3 h-11 w-full" />
      <Skeleton className="mt-3 h-11 w-full" />
      <Skeleton className="mt-5 h-11 w-36" />
    </div>
  );
}
