import { ScanResultsClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function ScanPage() {
  return (
    <DashboardShell title="QR and NFC entry">
      <ScanResultsClient />
    </DashboardShell>
  );
}
