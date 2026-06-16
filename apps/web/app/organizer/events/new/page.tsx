import { CreateEventForm } from "@/components/create-event-form";
import { DashboardShell } from "@/components/shell";

export default function CreateEventPage() {
  return (
    <DashboardShell title="Create event">
      <CreateEventForm />
    </DashboardShell>
  );
}
