import { DashboardShell } from "@/components/shell";
import { SettingsClient, ChangePasswordClient } from "@/components/settings-client";
import { VipSettingsClient } from "@/components/dashboard-clients";

export default function SettingsPage() {
  return (
    <DashboardShell title="Settings">
      <SettingsClient />
      <ChangePasswordClient />
      <VipSettingsClient />
    </DashboardShell>
  );
}
