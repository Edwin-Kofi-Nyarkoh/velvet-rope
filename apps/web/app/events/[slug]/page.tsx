import { EventDetailClient } from "@/components/event-detail-client";
import { PublicNav } from "@/components/shell";

export default async function EventDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div>
      <PublicNav />
      <EventDetailClient slug={slug} />
    </div>
  );
}
