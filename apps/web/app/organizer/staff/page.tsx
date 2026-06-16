import { StaffManagementClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function StaffPage() {
  return (
    <DashboardShell title="Staff management">
      <StaffManagementClient />
    </DashboardShell>
  );
}
