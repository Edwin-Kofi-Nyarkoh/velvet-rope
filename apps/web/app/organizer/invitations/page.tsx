import { InvitationsManagementClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function OrganizerInvitationsPage() {
  return (
    <DashboardShell title="Invitations">
      <InvitationsManagementClient />
    </DashboardShell>
  );
}
