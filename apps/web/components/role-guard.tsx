"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { readWebAuthUser } from "@/lib/auth-token";

const organizerRoles = ["ORGANIZER", "ADMIN", "SUPER_ADMIN"];

export function RoleGuard({ children, requireOrganizer = false }: { children: ReactNode; requireOrganizer?: boolean }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const user = readWebAuthUser();
    const ok = requireOrganizer ? Boolean(user?.role && organizerRoles.includes(user.role)) : Boolean(user);
    setAllowed(ok);
    if (!ok) router.replace(requireOrganizer ? "/login" : "/");
  }, [requireOrganizer, router]);

  if (!allowed) return null;
  return children;
}
