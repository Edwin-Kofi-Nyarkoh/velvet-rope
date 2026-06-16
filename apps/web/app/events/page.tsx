import { EventListClient } from "@/components/event-list-client";
import { PublicNav } from "@/components/shell";

export default function EventsPage() {
  return (
    <div>
      <PublicNav />
      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <EventListClient />
      </main>
    </div>
  );
}
