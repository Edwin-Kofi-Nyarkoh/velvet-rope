import { RoleGuard } from "@/components/role-guard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard>{children}</RoleGuard>;
}
