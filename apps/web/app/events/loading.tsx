import { Skeleton } from "@/components/ui/skeleton";

export default function EventsLoading() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex justify-between gap-4">
        <div>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="mt-3 h-5 w-96 max-w-full" />
        </div>
        <Skeleton className="hidden h-12 w-80 rounded-lg md:block" />
      </div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((item) => (
          <Skeleton key={item} className="h-80 rounded-lg" />
        ))}
      </div>
    </main>
  );
}
