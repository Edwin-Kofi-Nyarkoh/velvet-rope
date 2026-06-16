import { AttendeeDashboardClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function AttendeeDashboardPage() {
  return (
    <DashboardShell title="Attendee dashboard">
      <AttendeeDashboardClient />
    </DashboardShell>
  );
}
