import { Skeleton } from "@/components/ui/skeleton";

export default function TicketsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((item) => (
        <Skeleton key={item} className="h-48 rounded-lg" />
      ))}
    </div>
  );
}
