import { OrganizerAttendeesClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function AttendeesPage() {
  return (
    <DashboardShell title="Attendees">
      <OrganizerAttendeesClient />
    </DashboardShell>
  );
}
