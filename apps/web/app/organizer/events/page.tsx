import { OrganizerEventsClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OrganizerEventsPage() {
  return (
    <DashboardShell
      title="Manage events"
      action={
        <Link href="/organizer/events/new">
          <Button size="sm">Create event</Button>
        </Link>
      }
    >
      <OrganizerEventsClient />
    </DashboardShell>
  );
}
