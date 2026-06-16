import { AnalyticsClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function AnalyticsPage() {
  return (
    <DashboardShell title="Analytics">
      <AnalyticsClient />
    </DashboardShell>
  );
}
