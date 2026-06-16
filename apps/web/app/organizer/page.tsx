import { OrganizerOverviewClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function OrganizerPage() {
  return (
    <DashboardShell title="Organizer overview">
      <OrganizerOverviewClient />
    </DashboardShell>
  );
}
