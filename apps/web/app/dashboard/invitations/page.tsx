import { MyInvitationsClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function DashboardInvitationsPage() {
  return (
    <DashboardShell title="Invitations">
      <MyInvitationsClient />
    </DashboardShell>
  );
}
