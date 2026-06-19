"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  QrCode,
  Settings,
  ShoppingBag,
  Sun,
  Ticket,
  Users,
  X,
  MapPin,
  MessageSquare
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { clearWebAuth, readWebAuthUser, type WebAuthUser } from "@/lib/auth-token";
import { api } from "@/lib/api";

// ─── Theme toggle ─────────────────────────────────────────────────────────────

function useTheme() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("vr-theme");
    const dark = stored !== "light";
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  const toggle = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("vr-theme", next ? "dark" : "light");
  }, [isDark]);

  return { isDark, toggle };
}

export function ThemeToggle() {
  const { isDark, toggle } = useTheme();
  return (
    <button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className="flex size-9 items-center justify-center rounded-lg border border-vr-border text-vr-muted transition hover:border-vr-gold/40 hover:text-vr-text"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useStoredUser() {
  const [user, setUser] = useState<WebAuthUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(readWebAuthUser());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("velvet-auth", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("velvet-auth", sync);
    };
  }, []);

  return user;
}

// ─── Notification Bell ─────────────────────────────────────────────────────────

function NotificationBell() {
  const [token, setToken] = useState<string | null>(null);
  const [open, setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const sync = () => setToken(localStorage.getItem("velvet_access_token"));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("velvet-auth", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("velvet-auth", sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const countQuery = useQuery({
    queryKey: ["notification-count"],
    queryFn:  () => api.notificationUnreadCount(token!),
    enabled:  Boolean(token),
    refetchInterval: 60_000
  });

  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn:  () => api.notifications(token!),
    enabled:  open && Boolean(token)
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.markAllNotificationsRead(token!),
    onSuccess:  () => {
      void queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  if (!token) return null;

  const unread = countQuery.data?.data.count ?? 0;
  const items  = listQuery.data?.data ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-9 items-center justify-center rounded-lg border border-vr-border text-vr-muted transition hover:border-vr-gold/40 hover:text-vr-text"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-vr-gold text-[9px] font-bold text-vr-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-vr-border bg-vr-surface shadow-soft">
          <div className="flex items-center justify-between border-b border-vr-border px-4 py-3">
            <span className="text-sm font-semibold text-vr-text">Notifications</span>
            {unread > 0 && (
              <button
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="text-xs text-vr-gold hover:underline disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {listQuery.isLoading && (
              <p className="p-4 text-center text-sm text-vr-muted">Loading…</p>
            )}
            {!listQuery.isLoading && items.length === 0 && (
              <p className="p-6 text-center text-sm text-vr-muted">No notifications yet.</p>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`border-b border-vr-border px-4 py-3 last:border-0 ${!n.readAt ? "bg-vr-gold/5" : ""}`}
              >
                <div className="flex items-start gap-2.5">
                  {!n.readAt && <span className="mt-2 size-1.5 shrink-0 rounded-full bg-vr-gold" />}
                  <div className={!n.readAt ? "" : "pl-4"}>
                    <p className="text-sm font-medium text-vr-text">{n.title}</p>
                    <p className="mt-0.5 text-xs text-vr-muted">{n.body}</p>
                    <p className="mt-1 text-[10px] text-vr-muted/60">{new Date(n.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Navigation definitions ───────────────────────────────────────────────────

const attendeeNav = [
  { href: "/",                     label: "Home",        icon: Home          },
  { href: "/dashboard",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/dashboard/tickets",    label: "My Tickets",  icon: Ticket        },
  { href: "/dashboard/orders",     label: "Orders",      icon: ShoppingBag   },
  { href: "/dashboard/invitations",label: "Invitations", icon: MessageSquare },
  { href: "/dashboard/settings",   label: "Settings",    icon: Settings      }
];

const organizerNav = [
  { href: "/organizer",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/organizer/events",     label: "Events",      icon: CalendarDays },
  { href: "/organizer/attendees",  label: "Attendees",   icon: Users        },
  { href: "/organizer/invitations",label: "Invites",     icon: MessageSquare },
  { href: "/organizer/staff",      label: "Staff",       icon: Users        },
  { href: "/organizer/vendors",    label: "Vendors",     icon: Users        },
  { href: "/organizer/seating",    label: "Seating",     icon: MapPin       },
  { href: "/organizer/ticket-types", label: "Tickets",   icon: Ticket       },
  { href: "/organizer/analytics",  label: "Analytics",   icon: BarChart3    },
  { href: "/organizer/scan",       label: "Scanner",     icon: QrCode       }
];

// ─── Public top navigation ─────────────────────────────────────────────────

const publicLinks = [
  { href: "/events",  label: "Events"  },
  { href: "/pricing", label: "Pricing" }
];

export function PublicNav() {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = useStoredUser();
  const [open, setOpen] = useState(false);
  const isOrganizer = user ? ["ORGANIZER", "ADMIN", "SUPER_ADMIN"].includes(user.role) : false;

  useEffect(() => { setOpen(false); }, [pathname]);

  const logout = () => {
    clearWebAuth();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-vr-border bg-vr-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-vr-text">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gold-gradient text-xs font-bold text-vr-black">
            VR
          </span>
          <span className="hidden sm:inline">Velvet Rope</span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-6 text-sm text-vr-muted md:flex">
          {publicLinks.map(({ href, label }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={active ? "text-vr-gold font-medium" : "hover:text-vr-text transition-colors"}
              >
                {label}
              </Link>
            );
          })}
          {user && (
            <Link
              href={isOrganizer ? "/organizer" : "/dashboard"}
              className={
                pathname.startsWith(isOrganizer ? "/organizer" : "/dashboard")
                  ? "text-vr-gold font-medium"
                  : "hover:text-vr-text transition-colors"
              }
            >
              {isOrganizer ? "Organizer" : "My Events"}
            </Link>
          )}
        </nav>

        {/* Auth actions */}
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <NotificationBell />
                <span className="max-w-40 truncate text-sm text-vr-muted">{user.email}</span>
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="size-4" />
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Get started</Button>
                </Link>
              </>
            )}
          </div>

          {/* Theme toggle — always visible */}
          <ThemeToggle />

          {/* Mobile menu toggle */}
          <button
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex size-9 items-center justify-center rounded-lg border border-vr-border text-vr-muted transition hover:border-vr-gold/40 hover:text-vr-text md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-vr-border bg-vr-surface md:hidden">
          <div className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6">
            <nav className="grid gap-1 text-sm">
              {publicLinks.map(({ href, label }) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`rounded-lg px-3 py-2.5 font-medium transition ${
                      active
                        ? "bg-vr-gold/10 text-vr-gold"
                        : "text-vr-muted hover:bg-vr-card hover:text-vr-text"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 border-t border-vr-border pt-4">
              {user ? (
                <div className="grid gap-2">
                  <p className="truncate px-3 text-sm text-vr-muted">{user.email}</p>
                  <Button className="w-full" variant="secondary" size="sm" onClick={logout}>
                    Log out
                  </Button>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Link href="/login">
                    <Button className="w-full" variant="secondary">Log in</Button>
                  </Link>
                  <Link href="/register">
                    <Button className="w-full">Get started</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Dashboard sidebar shell ──────────────────────────────────────────────────

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) {
  const pathname = usePathname();
  const exact    = href === "/organizer" || href === "/dashboard" || href === "/";
  const active   = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-vr-gold/10 text-vr-gold border border-vr-gold/20"
          : "text-vr-muted hover:bg-vr-card hover:text-vr-text border border-transparent"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
      {active && <ChevronRight className="ml-auto size-3 text-vr-gold/60" />}
    </Link>
  );
}

export function DashboardShell({ children, title, action }: { children: React.ReactNode; title: string; action?: React.ReactNode }) {
  const user        = useStoredUser();
  const router      = useRouter();
  const isOrganizer = user ? ["ORGANIZER", "ADMIN", "SUPER_ADMIN"].includes(user.role) : false;
  const navItems    = isOrganizer ? organizerNav : attendeeNav;

  const logout = () => {
    clearWebAuth();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-vr-black">
      <PublicNav />

      <div className="mx-auto flex max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24 rounded-xl border border-vr-border bg-vr-surface p-3">
            <nav className="grid gap-0.5">
              {navItems.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </nav>
            <div className="mt-4 border-t border-vr-border pt-4">
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-vr-muted transition hover:bg-vr-card hover:text-vr-danger"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-vr-text">{title}</h1>
            {action && <div>{action}</div>}
          </div>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-vr-border bg-vr-surface lg:hidden">
        <div className="flex items-center">
          {navItems.slice(0, 5).map(({ href, label, icon: Icon }) => (
            <MobileNavItem key={href} href={href} label={label} Icon={Icon} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function MobileNavItem({ href, label, Icon }: { href: string; label: string; Icon: typeof Home }) {
  const pathname = usePathname();
  const exact    = href === "/organizer" || href === "/dashboard" || href === "/";
  const active   = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-medium transition ${
        active ? "text-vr-gold" : "text-vr-muted hover:text-vr-text"
      }`}
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </Link>
  );
}

// ─── Event card ────────────────────────────────────────────────────────────────

export function EventCard({
  title,
  meta,
  price,
  href,
  imageUrl
}: {
  title:     string;
  meta:      string;
  price:     string;
  href?:     string;
  imageUrl?: string;
}) {
  const content = (
    <article className="group h-full rounded-xl border border-vr-border bg-vr-card shadow-soft transition-all duration-200 hover:border-vr-gold/40 hover:shadow-gold hover:-translate-y-0.5">
      {/* Cover image */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-xl bg-vr-surface">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 bg-purple-gradient opacity-40" />
        )}
        {/* Price badge */}
        <span className="absolute right-3 top-3 rounded-full border border-vr-gold/40 bg-vr-black/80 px-2.5 py-1 text-xs font-semibold text-vr-gold backdrop-blur-sm">
          {price}
        </span>
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-vr-text line-clamp-1">{title}</h3>
        <p className="mt-1 text-sm text-vr-muted line-clamp-1">{meta}</p>
      </div>
    </article>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

// ─── Metric strip (home page) ─────────────────────────────────────────────────

export function MetricStrip() {
  const stats = [
    { value: "98%",  label: "faster admission" },
    { value: "14k+", label: "tickets managed"  },
    { value: "24/7", label: "event visibility"  }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map(({ value, label }) => (
        <div key={label} className="rounded-xl border border-vr-border bg-vr-card p-4">
          <div className="text-2xl font-bold text-vr-gold">{value}</div>
          <div className="mt-0.5 text-sm text-vr-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── App footer ────────────────────────────────────────────────────────────────

export function AppFooter() {
  const pathname = usePathname();
  // Hide on authenticated dashboard and organizer routes
  const hidden = pathname.startsWith("/dashboard") || pathname.startsWith("/organizer");
  if (hidden) return null;

  return (
    <footer className="border-t border-vr-border bg-vr-surface">
      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-10 text-sm text-vr-muted sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
        <div>
          <div className="flex items-center gap-2 font-semibold text-vr-text">
            <span className="flex size-7 items-center justify-center rounded-md bg-gold-gradient text-xs font-bold text-vr-black">
              VR
            </span>
            Velvet Rope
          </div>
          <p className="mt-3 max-w-sm leading-6">
            Secure event ticketing, VIP invitations, QR entry, cashless vendors, table management, and analytics.
          </p>
          <p className="mt-4 text-xs">© {new Date().getFullYear()} Velvet Rope. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm md:flex-col md:gap-3 md:text-right">
          <Link href="/events"  className="hover:text-vr-gold transition-colors">Events</Link>
          <Link href="/pricing" className="hover:text-vr-gold transition-colors">Pricing</Link>
          <Link href="/login"   className="hover:text-vr-gold transition-colors">Login</Link>
        </div>
      </div>
    </footer>
  );
}
