import { VendorManagementClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function VendorsPage() {
  return (
    <DashboardShell title="Vendor management">
      <VendorManagementClient />
    </DashboardShell>
  );
}
