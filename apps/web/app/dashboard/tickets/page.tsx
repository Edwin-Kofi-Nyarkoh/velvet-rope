import { DashboardShell } from "@/components/shell";
import { TicketsClient } from "@/components/tickets-client";

export default function TicketsPage() {
  return (
    <DashboardShell title="My tickets">
      <TicketsClient />
    </DashboardShell>
  );
}
