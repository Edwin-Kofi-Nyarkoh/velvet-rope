import { SeatingManagementClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function SeatingPage() {
  return (
    <DashboardShell title="Seat and table management">
      <SeatingManagementClient />
    </DashboardShell>
  );
}
