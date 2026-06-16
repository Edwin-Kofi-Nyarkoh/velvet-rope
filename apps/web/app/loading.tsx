import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-4 h-5 w-full max-w-2xl" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-72 rounded-lg" />
        ))}
      </div>
    </main>
  );
}
