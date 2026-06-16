import { RoleGuard } from "@/components/role-guard";

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard requireOrganizer>{children}</RoleGuard>;
}
