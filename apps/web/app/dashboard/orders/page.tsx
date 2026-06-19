import { DashboardShell } from "@/components/shell";
import { OrdersClient } from "@/components/dashboard-clients";

export default function OrdersPage() {
  return (
    <DashboardShell title="My orders">
      <OrdersClient />
    </DashboardShell>
  );
}
