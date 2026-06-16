import { Skeleton } from "@/components/ui/skeleton";

export default function EventDetailsLoading() {
  return (
    <main className="mx-auto grid max-w-[1440px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
      <section>
        <Skeleton className="aspect-[16/7] rounded-lg" />
        <Skeleton className="mt-8 h-11 w-2/3" />
        <Skeleton className="mt-4 h-5 w-full max-w-4xl" />
        <Skeleton className="mt-3 h-5 w-3/4 max-w-3xl" />
      </section>
      <aside className="rounded-2xl border border-vr-border bg-vr-card p-5">
        <Skeleton className="h-6 w-24" />
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="mt-4 h-20 rounded-lg" />
        ))}
      </aside>
    </main>
  );
}
