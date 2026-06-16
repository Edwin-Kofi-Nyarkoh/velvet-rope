import { OrganizerTicketTypesClient } from "@/components/dashboard-clients";
import { DashboardShell } from "@/components/shell";

export default function TicketTypesPage() {
  return (
    <DashboardShell title="Ticket types">
      <OrganizerTicketTypesClient />
    </DashboardShell>
  );
}
