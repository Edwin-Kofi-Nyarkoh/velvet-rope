import { DashboardShell } from "@/components/shell";
import { SettingsClient } from "@/components/settings-client";
import { VipSettingsClient } from "@/components/dashboard-clients";

export default function SettingsPage() {
  return (
    <DashboardShell title="Settings">
      <SettingsClient />
      <VipSettingsClient />
    </DashboardShell>
  );
}
