"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  BarChart3,
  CalendarPlus,
  CheckCircle2,
  MessageSquare,
  Plus,
  Wifi,
  QrCode,
  Share2,
  ShieldCheck,
  Ticket,
  Users,
  WalletCards
} from "lucide-react";
import { api } from "@/lib/api";
import { getWebAccessToken } from "@/lib/auth-token";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { Badge, EventStatusBadge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";

// ─── Types & helpers ──────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

async function token() {
  return getWebAccessToken();
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  accent = false
}: {
  icon:    ElementType;
  label:   string;
  value:   string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-vr-border bg-vr-card p-5 shadow-soft">
      <div
        className={`mb-3 flex size-10 items-center justify-center rounded-lg border ${
          accent
            ? "border-vr-gold/30 bg-vr-gold/10"
            : "border-vr-border bg-vr-surface"
        }`}
      >
        <Icon className={`size-5 ${accent ? "text-vr-gold" : "text-vr-muted"}`} />
      </div>
      <p className="text-sm text-vr-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-vr-gold" : "text-vr-text"}`}>
        {value}
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-vr-border bg-vr-card p-5">
      <h2 className="mb-4 font-semibold text-vr-text">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function LoadingGrid({ cols = 3 }: { cols?: number }) {
  return (
    <div className={`grid gap-4 ${cols === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Attendee dashboard ───────────────────────────────────────────────────────

export function AttendeeDashboardClient() {
  const dashboard = useQuery({
    queryKey: ["attendee-dashboard"],
    queryFn:  async () => api.attendeeDashboard(await token()),
    retry: false
  });
  const vip = useQuery({
    queryKey: ["vip-verification"],
    queryFn:  async () => api.vipVerification(await token()),
    retry: false
  });
  const seating = useQuery({
    queryKey: ["my-seating"],
    queryFn:  async () => api.mySeating(await token()),
    retry: false
  });

  if (dashboard.isLoading) return <LoadingGrid cols={4} />;
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} />;

  const data         = dashboard.data?.data as AnyRecord;
  const tickets      = (data.tickets      ?? []) as AnyRecord[];
  const invitations  = (data.invitations  ?? []) as AnyRecord[];
  const transactions = (data.vendorTransactions ?? []) as AnyRecord[];
  const vipAccounts  = (vip.data?.data as AnyRecord)?.accounts as AnyRecord[] ?? [];
  const seats        = (seating.data?.data ?? []) as AnyRecord[];
  const verifiedVip  = vipAccounts.filter((a) => a.vipStatus === "VERIFIED").length;
  const vendorSpend  = transactions.reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  return (
    <div className="grid gap-6">
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Ticket}     label="Active tickets"  value={tickets.length}                         />
        <MetricCard icon={Users}      label="Invitations"     value={invitations.length}                     />
        <MetricCard icon={ShieldCheck}label="VIP accounts"    value={verifiedVip}     accent={verifiedVip > 0} />
        <MetricCard icon={WalletCards}label="Vendor spend"    value={`GHS ${vendorSpend.toLocaleString()}`} accent />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Ticket cards */}
        <div className="grid gap-4 md:grid-cols-2 md:content-start">
          {tickets.length === 0 ? (
            <EmptyState
              icon={Ticket}
              title="No active tickets"
              description="Buy a ticket — your QR/NFC pass, seat, and event details appear here."
              className="md:col-span-2"
            />
          ) : (
            tickets.map((ticket) => (
              <div
                key={String(ticket.id)}
                className="rounded-xl border border-vr-border bg-vr-card p-5 transition-all hover:border-vr-gold/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-vr-text">{String(ticket.eventTitle)}</h3>
                    <p className="mt-1 text-sm text-vr-muted">
                      {String(ticket.ticketType)} · {String(ticket.status)}
                    </p>
                  </div>
                  {ticket.nfcEnabled ? (
                    <Wifi className="size-5 text-vr-gold" />
                  ) : (
                    <QrCode className="size-5 text-vr-muted" />
                  )}
                </div>
                <p className="mt-4 rounded-lg bg-vr-surface px-3 py-2 text-xs text-vr-muted">
                  {ticket.seat
                    ? `${String((ticket.seat as AnyRecord).table ?? "Seat")} ${String((ticket.seat as AnyRecord).label)} — ${String((ticket.seat as AnyRecord).zone ?? "Main floor")}`
                    : "Seat assignment pending"}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Side panels */}
        <div className="grid gap-4">
          <Panel title="My seats">
            {seats.length === 0 ? (
              <p className="text-sm text-vr-muted">No assigned seats yet.</p>
            ) : (
              seats.map((seat) => (
                <div key={String(seat.id)} className="rounded-lg bg-vr-surface px-3 py-2.5 text-sm">
                  <p className="font-medium text-vr-text">
                    {String(seat.eventTitle)} — {String(seat.table)} {String(seat.label)}
                  </p>
                  <p className="mt-0.5 text-xs text-vr-muted">
                    {(seat.route as string[] | undefined)?.join(" → ") ?? ""}
                  </p>
                </div>
              ))
            )}
          </Panel>

          <Panel title="VIP verification">
            {vipAccounts.length === 0 ? (
              <p className="text-sm text-vr-muted">
                Link X, LinkedIn, or Facebook in settings to request VIP verification.
              </p>
            ) : (
              vipAccounts.map((account) => (
                <div
                  key={String(account.id)}
                  className="flex items-center justify-between rounded-lg bg-vr-surface px-3 py-2.5 text-sm"
                >
                  <span className="text-vr-text">
                    {String(account.provider)} @{String(account.handle)}
                  </span>
                  <Badge
                    variant={account.vipStatus === "VERIFIED" ? "gold" : "muted"}
                  >
                    {String(account.vipStatus)}
                  </Badge>
                </div>
              ))
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export function MyInvitationsClient() {
  const invitations = useQuery({
    queryKey: ["my-invitations"],
    queryFn:  async () => api.myInvitations(await token()),
    retry: false
  });

  if (invitations.isLoading) return <LoadingGrid />;
  if (invitations.isError)   return <ErrorState message={invitations.error.message} />;

  const rows = (invitations.data?.data ?? []) as AnyRecord[];

  if (!rows.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No invitations yet"
        description="Private invitations and RSVP status will appear here."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {rows.map((inv) => (
        <div
          key={String(inv.id)}
          className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-vr-border bg-vr-card p-5"
        >
          <div>
            <h3 className="font-semibold text-vr-text">{String(inv.eventTitle)}</h3>
            <p className="mt-1 text-sm text-vr-muted">From {String(inv.sender)}</p>
            {Boolean(inv.message) && <p className="mt-3 text-sm text-vr-text">{String(inv.message)}</p>}
          </div>
          <Badge variant={inv.status === "ACCEPTED" ? "success" : inv.status === "DECLINED" ? "danger" : "warning"}>
            {String(inv.status)}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ─── VIP settings ─────────────────────────────────────────────────────────────

export function VipSettingsClient() {
  const queryClient = useQueryClient();
  const [provider, setProvider]           = useState<"FACEBOOK" | "LINKEDIN" | "X" | "INSTAGRAM" | "TIKTOK">("X");
  const [handle, setHandle]               = useState("");
  const [displayName, setDisplayName]     = useState("");
  const [followerCount, setFollowerCount] = useState("0");
  const [evidenceUrl, setEvidenceUrl]     = useState("");

  const vip = useQuery({
    queryKey: ["vip-verification"],
    queryFn:  async () => api.vipVerification(await token()),
    retry: false
  });

  const accountMutation = useMutation({
    mutationFn: async () =>
      api.upsertSocialAccount(await token(), {
        provider,
        handle,
        displayName: displayName || handle,
        followerCount: Number(followerCount) || 0
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vip-verification"] })
  });

  const verifyMutation = useMutation({
    mutationFn: async () =>
      api.submitVipVerification(await token(), {
        provider,
        handle,
        evidenceUrl: evidenceUrl || undefined
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vip-verification"] })
  });

  const accounts = ((vip.data?.data as AnyRecord)?.accounts ?? []) as AnyRecord[];

  return (
    <div className="max-w-2xl rounded-xl border border-vr-border bg-vr-card p-6">
      <h2 className="text-lg font-semibold text-vr-text">Social &amp; VIP verification</h2>
      <p className="mt-1.5 text-sm text-vr-muted">
        Link Facebook, LinkedIn, or X accounts so attendees can see friends attending and request VIP influencer verification.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <select
          className="h-11 rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text outline-none focus:border-vr-gold"
          value={provider}
          onChange={(e) => setProvider(e.target.value as typeof provider)}
        >
          {(["X", "FACEBOOK", "LINKEDIN", "INSTAGRAM", "TIKTOK"] as const).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input
          className="h-11 rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
          placeholder="Handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
        <input
          className="h-11 rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          className="h-11 rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
          placeholder="Follower count"
          value={followerCount}
          onChange={(e) => setFollowerCount(e.target.value)}
        />
        <input
          className="h-11 rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold sm:col-span-2"
          placeholder="Evidence URL for VIP verification"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={!handle || accountMutation.isPending}
          onClick={() => accountMutation.mutate()}
        >
          {accountMutation.isPending ? "Saving…" : "Link account"}
        </Button>
        <Button
          variant="secondary"
          disabled={!handle || verifyMutation.isPending}
          onClick={() => verifyMutation.mutate()}
        >
          {verifyMutation.isPending ? "Submitting…" : "Request VIP verification"}
        </Button>
      </div>

      {accounts.length > 0 && (
        <div className="mt-5 grid gap-2">
          {accounts.map((account) => (
            <div
              key={String(account.id)}
              className="flex items-center justify-between rounded-lg bg-vr-surface px-3 py-2.5 text-sm"
            >
              <span className="text-vr-text">
                {String(account.provider)} @{String(account.handle)}
              </span>
              <Badge variant={account.vipStatus === "VERIFIED" ? "gold" : "muted"}>
                {String(account.vipStatus)}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {(accountMutation.isError || verifyMutation.isError) && (
        <p className="mt-4 text-sm text-vr-danger">
          {accountMutation.error?.message ?? verifyMutation.error?.message}
        </p>
      )}
    </div>
  );
}

// ─── Organizer overview ───────────────────────────────────────────────────────

export function OrganizerOverviewClient() {
  const dashboard = useQuery({
    queryKey: ["organizer-dashboard"],
    queryFn:  async () => api.organizerDashboard(await token()),
    retry: false
  });

  if (dashboard.isLoading) return <LoadingGrid />;
  if (dashboard.isError)   return <ErrorState message={dashboard.error.message} />;

  const data    = dashboard.data?.data as AnyRecord;
  const metrics = (data.metrics ?? {}) as AnyRecord;
  const events  = (data.events  ?? []) as AnyRecord[];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard icon={WalletCards}  label="Revenue (GHS)"  value={`${Number(metrics.revenue ?? 0).toLocaleString()}`} accent />
        <MetricCard icon={Ticket}       label="Tickets sold"   value={Number(metrics.ticketsSold ?? 0)} />
        <MetricCard icon={CheckCircle2} label="Check-ins"      value={Number(metrics.checkIns ?? 0)} />
      </div>

      <Panel title="Event operations">
        <div className="overflow-hidden rounded-lg border border-vr-border">
          {events.length === 0 ? (
            <p className="p-4 text-sm text-vr-muted">No events yet. Create your first event to get started.</p>
          ) : (
            events.map((event) => (
              <div
                key={String(event.id)}
                className="grid gap-2 border-b border-vr-border p-4 text-sm last:border-b-0 md:grid-cols-5"
              >
                <span className="font-medium text-vr-text">{String(event.title)}</span>
                <EventStatusBadge status={String(event.status)} />
                <span className="text-vr-muted">{String(event.ticketsSold)} sold</span>
                <span className="text-vr-muted">{String(event.checkIns)} check-ins</span>
                <span className={event.isPopular ? "text-vr-gold font-medium" : "text-vr-muted"}>
                  {event.isPopular ? "Popular" : "Standard"}
                </span>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

// ─── Staff management ─────────────────────────────────────────────────────────

export function StaffManagementClient() {
  const staff    = useQuery({ queryKey: ["staff"],          queryFn: async () => api.staff(await token()),          retry: false });
  const messages = useQuery({ queryKey: ["communications"], queryFn: async () => api.communications(await token()), retry: false });

  if (staff.isLoading || messages.isLoading) return <LoadingGrid />;

  const staffRows = (staff.data?.data ?? []) as AnyRecord[];

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {staffRows.length === 0 ? (
          <EmptyState icon={Users} title="No staff assigned" description="Add staff members to grant event permissions." className="md:col-span-3" />
        ) : (
          staffRows.map((perm) => (
            <div key={String(perm.id)} className="rounded-xl border border-vr-border bg-vr-card p-5">
              <h3 className="font-semibold text-vr-text">
                {String((perm.user as AnyRecord)?.profile ? ((perm.user as AnyRecord).profile as AnyRecord).fullName : (perm.user as AnyRecord)?.email ?? "Staff")}
              </h3>
              <p className="mt-1.5 text-sm text-vr-muted">{String((perm.event as AnyRecord)?.title ?? "")}</p>
              <div className="mt-3 flex gap-2">
                <Badge variant={perm.canScanTickets ? "success" : "muted"}>Scan</Badge>
                <Badge variant={perm.canManageGuests ? "success" : "muted"}>Guests</Badge>
              </div>
            </div>
          ))
        )}
      </div>

      <CommunicationPanel messages={(messages.data?.data ?? []) as AnyRecord[]} />
    </div>
  );
}

// ─── Vendor management ────────────────────────────────────────────────────────

export function VendorManagementClient() {
  const vendors      = useQuery({ queryKey: ["vendors"],             queryFn: async () => api.vendors(await token()),             retry: false });
  const transactions = useQuery({ queryKey: ["vendor-transactions"], queryFn: async () => api.vendorTransactions(await token()), retry: false });
  const queryClient  = useQueryClient();

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => api.confirmVendorTransaction(await token(), id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["vendor-transactions"] })
  });

  if (vendors.isLoading || transactions.isLoading) return <LoadingGrid />;

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        {((vendors.data?.data ?? []) as AnyRecord[]).map((vendor) => (
          <div key={String(vendor.id)} className="rounded-xl border border-vr-border bg-vr-card p-5">
            <h3 className="font-semibold text-vr-text">{String(vendor.businessName)}</h3>
            <p className="mt-1.5 text-sm text-vr-muted">
              {String(vendor.category)} · {String((vendor.event as AnyRecord)?.title ?? "Unassigned")}
            </p>
          </div>
        ))}
      </div>

      <Panel title="Cashless in-event transactions">
        {((transactions.data?.data ?? []) as AnyRecord[]).length === 0 ? (
          <p className="text-sm text-vr-muted">No transactions yet.</p>
        ) : (
          ((transactions.data?.data ?? []) as AnyRecord[]).map((tx) => (
            <div
              key={String(tx.id)}
              className="grid gap-2 rounded-xl bg-vr-surface p-4 text-sm md:grid-cols-[1fr_auto_auto]"
            >
              <div>
                <p className="font-medium text-vr-text">{String(tx.description)}</p>
                <p className="text-vr-muted">{String(tx.vendor)} · {String(tx.attendee)}</p>
              </div>
              <span className="font-semibold text-vr-text">
                {String(tx.currency)} {Number(tx.amount).toLocaleString()}
              </span>
              {tx.status === "PENDING" ? (
                <Button variant="secondary" size="sm" onClick={() => confirmMutation.mutate(String(tx.id))}>
                  Confirm paid
                </Button>
              ) : (
                <Badge variant="success">{String(tx.status)}</Badge>
              )}
            </div>
          ))
        )}
      </Panel>
    </div>
  );
}

// ─── Seating management ───────────────────────────────────────────────────────

export function SeatingManagementClient() {
  const seating = useQuery({
    queryKey: ["organizer-seating"],
    queryFn:  async () => api.organizerSeating(await token()),
    retry: false
  });

  if (seating.isLoading) return <LoadingGrid />;
  if (seating.isError)   return <ErrorState message={seating.error.message} />;

  const events = (seating.data?.data ?? []) as AnyRecord[];
  const event  = events[0];

  if (!event) {
    return (
      <EmptyState
        icon={WalletCards}
        title="No seating plans"
        description="Create tables and seats to begin assigning attendees."
      />
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Seat grid */}
      <div className="grid grid-cols-6 gap-2 rounded-xl border border-vr-border bg-vr-card p-5 sm:grid-cols-8 lg:grid-cols-10">
        {((event.seats ?? []) as AnyRecord[]).map((seat) => (
          <div
            key={String(seat.id)}
            className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-[10px] font-semibold transition ${
              seat.status === "ASSIGNED"
                ? "border-vr-gold/50 bg-vr-gold/10 text-vr-gold"
                : "border-vr-border bg-vr-surface text-vr-muted"
            }`}
          >
            <span>{String(seat.label)}</span>
            {Boolean(seat.attendee) && (
              <span className="mt-0.5 max-w-full truncate px-0.5 text-[8px]">
                {String(seat.attendee).split(" ")[0]}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Table summary */}
      <Panel title={String(event.title)}>
        {((event.tables ?? []) as AnyRecord[]).map((table) => (
          <div key={String(table.id)} className="rounded-lg bg-vr-surface px-3 py-2.5 text-sm">
            <p className="font-medium text-vr-text">{String(table.name)}</p>
            <p className="mt-0.5 text-xs text-vr-muted">
              {String(table.assigned)}/{String(table.capacity)} assigned · {String(table.zone)}
            </p>
          </div>
        ))}
      </Panel>
    </div>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function AnalyticsClient() {
  const dashboard = useQuery({
    queryKey: ["organizer-dashboard"],
    queryFn:  async () => api.organizerDashboard(await token()),
    retry: false
  });
  const social = useQuery({
    queryKey: ["hashtag-analytics"],
    queryFn:  async () => api.hashtagAnalytics(await token()),
    retry: false
  });

  if (dashboard.isLoading || social.isLoading) return <LoadingGrid cols={4} />;

  const metrics = ((dashboard.data?.data as AnyRecord)?.metrics ?? {}) as AnyRecord;
  const summary = ((social.data?.data  as AnyRecord)?.summary   ?? []) as AnyRecord[];
  const mentions = ((social.data?.data  as AnyRecord)?.mentions  ?? []) as AnyRecord[];

  const totalReach = summary.reduce((sum, item) => sum + Number(item.reach ?? 0), 0);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={WalletCards}  label="Revenue (GHS)"  value={Number(metrics.revenue ?? 0).toLocaleString()} accent />
        <MetricCard icon={Ticket}       label="Tickets sold"   value={Number(metrics.ticketsSold ?? 0)} />
        <MetricCard icon={CheckCircle2} label="Check-ins"      value={Number(metrics.checkIns ?? 0)} />
        <MetricCard icon={Share2}       label="Social reach"   value={totalReach.toLocaleString()} />
      </div>

      <Panel title="Social media &amp; hashtag analytics">
        <div className="grid gap-3 md:grid-cols-2">
          {summary.length === 0 ? (
            <p className="text-sm text-vr-muted md:col-span-2">No social analytics yet.</p>
          ) : (
            summary.map((item) => (
              <div
                key={`${item.provider}-${item.hashtag}`}
                className="rounded-lg bg-vr-surface px-3 py-3 text-sm"
              >
                <p className="font-medium text-vr-text">
                  {String(item.provider)} {String(item.hashtag)}
                </p>
                <p className="mt-1 text-xs text-vr-muted">
                  {String(item.mentions)} mentions · {Number(item.reach).toLocaleString()} reach · {Number(item.engagement).toLocaleString()} engagements
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel title="Recent social mentions">
        {mentions.slice(0, 6).map((mention) => (
          <div key={String(mention.id)} className="border-b border-vr-border py-3 text-sm last:border-b-0">
            <p className="font-medium text-vr-text">
              @{String(mention.authorHandle)} · {String(mention.eventTitle)}
            </p>
            <p className="mt-1 text-vr-muted">{String(mention.content)}</p>
          </div>
        ))}
      </Panel>
    </div>
  );
}

// ─── Invitations management ───────────────────────────────────────────────────

export function InvitationsManagementClient() {
  const dashboard = useQuery({
    queryKey: ["organizer-dashboard"],
    queryFn:  async () => api.organizerDashboard(await token()),
    retry: false
  });
  const [eventId, setEventId]           = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [email, setEmail]               = useState("");
  const mutation = useMutation({
    mutationFn: async () => api.createInvitation(await token(), { eventId, recipientName, email })
  });

  const events = ((dashboard.data?.data as AnyRecord)?.events ?? []) as AnyRecord[];

  useMemo(() => {
    if (!eventId && events[0]?.id) setEventId(String(events[0].id));
  }, [eventId, events]);

  return (
    <div className="rounded-xl border border-vr-border bg-vr-card p-5">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <select
          className="h-11 rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text outline-none focus:border-vr-gold"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          {events.map((event) => (
            <option key={String(event.id)} value={String(event.id)}>{String(event.title)}</option>
          ))}
        </select>
        <input
          className="h-11 rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
          placeholder="Recipient name"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
        />
        <input
          className="h-11 rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button
          disabled={!eventId || !recipientName || !email || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Sending…" : "Send invite"}
        </Button>
      </div>
      {mutation.isError && (
        <p className="mt-4 text-sm text-vr-danger">{mutation.error.message}</p>
      )}
      {mutation.isSuccess && (
        <p className="mt-4 text-sm text-vr-success">Invitation sent successfully.</p>
      )}
    </div>
  );
}

// ─── Scanner / check-in ───────────────────────────────────────────────────────

export function ScanResultsClient() {
  const [mode, setMode]       = useState<"QR" | "NFC">("QR");
  const [payload, setPayload] = useState("");
  const [gate, setGate]       = useState("Main");

  const mutation = useMutation({
    mutationFn: async () =>
      mode === "QR"
        ? api.validateCheckIn(await token(), { qrCodePayload: payload, gate })
        : api.validateNfcCheckIn(await token(), { nfcToken: payload, gate })
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Input panel */}
      <div className="rounded-xl border border-vr-border bg-vr-card p-6">
        <div className="mb-5 flex gap-2">
          {(["QR", "NFC"] as const).map((m) => (
            <Button
              key={m}
              variant={mode === m ? "primary" : "secondary"}
              size="sm"
              onClick={() => setMode(m)}
            >
              {m === "QR" ? <QrCode className="size-4" /> : <ShieldCheck className="size-4" />}
              {m}
            </Button>
          ))}
        </div>

        <label className="mb-2 block text-sm font-medium text-vr-text">
          {mode === "QR" ? "QR code payload" : "NFC wristband token"}
        </label>
        <textarea
          className="min-h-32 w-full rounded-lg border border-vr-border bg-vr-surface p-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder={mode === "QR" ? "Paste or scan QR payload…" : "Paste NFC token…"}
        />
        <input
          className="mt-3 h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
          value={gate}
          onChange={(e) => setGate(e.target.value)}
          placeholder="Gate / entry point"
        />
        <Button
          className="mt-4 w-full"
          size="lg"
          disabled={!payload || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Validating…" : "Confirm entry"}
        </Button>
      </div>

      {/* Result panel */}
      <div className="rounded-xl border border-vr-border bg-vr-card p-6">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-vr-border bg-vr-surface">
          <ShieldCheck className={`size-6 ${mutation.isSuccess ? "text-vr-success" : "text-vr-muted"}`} />
        </div>
        <h2 className="text-xl font-semibold text-vr-text">Scan result</h2>

        {mutation.isError && (
          <div className="mt-4 rounded-lg border border-vr-danger/30 bg-vr-danger/10 p-3 text-sm text-vr-danger">
            {mutation.error.message}
          </div>
        )}

        {mutation.isSuccess ? (
          <dl className="mt-5 grid gap-3 text-sm">
            {Object.entries(mutation.data.data).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 border-b border-vr-border pb-2 last:border-b-0">
                <dt className="text-vr-muted capitalize">{key}</dt>
                <dd className="font-medium text-vr-text text-right">{String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-vr-muted">
            Paste a ticket QR payload or NFC wristband token above to validate entry.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Calendar button ──────────────────────────────────────────────────────────

export function CalendarButton({ eventId }: { eventId: string }) {
  const mutation = useMutation({
    mutationFn: () => api.calendarEvent(eventId),
    onSuccess: (result) => {
      const ics  = (result.data as AnyRecord).ics as string;
      const name = (result.data as AnyRecord).filename as string;
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  return (
    <Button variant="secondary" onClick={() => mutation.mutate()}>
      <CalendarPlus className="size-4" />
      Add to Calendar
    </Button>
  );
}

// ─── Friends attending ────────────────────────────────────────────────────────

export function FriendsAttendingClient({ eventId }: { eventId: string }) {
  const friends = useQuery({
    queryKey: ["friends-attending", eventId],
    queryFn:  async () => api.friendsAttending(await token(), eventId),
    retry: false
  });

  if (friends.isLoading) return <Skeleton className="mt-6 h-20 rounded-xl" />;
  if (friends.isError)   return null;

  const rows = (friends.data?.data ?? []) as AnyRecord[];
  if (!rows.length) return null;

  return (
    <div className="mt-6 rounded-xl border border-vr-border bg-vr-card p-5">
      <h2 className="font-semibold text-vr-text">Friends attending</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {rows.map((friend) => (
          <span
            key={String(friend.id)}
            className="rounded-full border border-vr-border bg-vr-surface px-3 py-1.5 text-sm text-vr-text"
          >
            {String(friend.fullName)} · {String(friend.provider)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Communication panel ──────────────────────────────────────────────────────

function CommunicationPanel({ messages }: { messages: AnyRecord[] }) {
  return (
    <Panel title="Staff &amp; vendor communication">
      {messages.length === 0 ? (
        <p className="text-sm text-vr-muted">No messages yet.</p>
      ) : (
        messages.map((message) => (
          <div key={String(message.id)} className="border-b border-vr-border py-3 text-sm last:border-b-0">
            <p className="font-medium text-vr-text">{String(message.subject)}</p>
            <p className="mt-1 text-xs text-vr-muted">
              {String(message.eventTitle)} · {String(message.audience)} · {String(message.sender)}
            </p>
            {Boolean(message.body) && <p className="mt-2 text-vr-muted">{String(message.body)}</p>}
          </div>
        ))
      )}
    </Panel>
  );
}

// ─── Organizer events list ─────────────────────────────────────────────────────

export function OrganizerEventsClient() {
  const dashboard = useQuery({
    queryKey: ["organizer-dashboard"],
    queryFn:  async () => api.organizerDashboard(await token()),
    retry: false
  });

  const events = (dashboard.data?.data?.events ?? []) as AnyRecord[];

  if (dashboard.isPending) return (
    <div className="grid gap-3">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );
  if (dashboard.isError) return <ErrorState message={dashboard.error.message} onRetry={dashboard.refetch} />;
  if (events.length === 0) return (
    <EmptyState
      icon={CalendarPlus}
      title="No events yet"
      description="Create your first event to start selling tickets."
      action={{ label: "Create event", href: "/organizer/events/new" }}
    />
  );

  return (
    <div className="grid gap-3">
      {events.map((event) => (
        <div
          key={String(event.id)}
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-vr-border bg-vr-card p-5 transition-all hover:border-vr-gold/30"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-vr-text">{String(event.title)}</p>
            <p className="mt-1 text-sm text-vr-muted">
              {new Date(String(event.startsAt)).toLocaleDateString()} ·{" "}
              <span className="text-vr-gold">{String(event.ticketsSold)} sold</span> ·{" "}
              {String(event.checkIns)} checked in
            </p>
          </div>
          <EventStatusBadge status={String(event.status)} />
        </div>
      ))}
    </div>
  );
}

// ─── Organizer attendees list ──────────────────────────────────────────────────

export function OrganizerAttendeesClient() {
  const query = useQuery({
    queryKey: ["organizer-attendees"],
    queryFn:  async () => api.organizerAttendees(await token()),
    retry: false
  });

  const rows = (query.data?.data ?? []) as AnyRecord[];

  if (query.isPending) return <LoadingGrid cols={3} />;
  if (query.isError) return <ErrorState message={query.error.message} onRetry={query.refetch} />;
  if (rows.length === 0) return (
    <EmptyState
      icon={Users}
      title="No attendees yet"
      description="Attendees appear here once tickets are purchased for your events."
    />
  );

  return (
    <div className="overflow-hidden rounded-xl border border-vr-border bg-vr-card">
      <div className="grid grid-cols-4 border-b border-vr-border bg-vr-surface px-5 py-3 text-xs font-medium uppercase tracking-wide text-vr-muted">
        <span>Name</span>
        <span>Event</span>
        <span>Ticket</span>
        <span className="text-right">Status</span>
      </div>
      {rows.map((row) => (
        <div
          key={String(row.id)}
          className="grid grid-cols-4 items-center border-b border-vr-border px-5 py-3.5 text-sm last:border-b-0"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-vr-text">{String(row.attendeeName)}</p>
            <p className="truncate text-xs text-vr-muted">{String(row.attendeeEmail)}</p>
          </div>
          <span className="truncate text-vr-muted">{String(row.eventTitle)}</span>
          <span className="text-vr-muted">{String(row.ticketType)}</span>
          <div className="flex justify-end">
            <Badge
              variant={
                String(row.status) === "ACTIVE"   ? "success" :
                String(row.status) === "USED"     ? "muted"   : "danger"
              }
            >
              {String(row.status)}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Organizer ticket types ────────────────────────────────────────────────────

export function OrganizerTicketTypesClient() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    eventId:  "",
    name:     "",
    kind:     "REGULAR",
    price:    "",
    currency: "GHS",
    quantity: ""
  });

  const dashboardQ = useQuery({
    queryKey: ["organizer-dashboard"],
    queryFn:  async () => api.organizerDashboard(await token()),
    retry: false
  });

  const ticketTypesQ = useQuery({
    queryKey: ["organizer-ticket-types"],
    queryFn:  async () => api.ticketTypes(await token()),
    retry: false
  });

  const events      = (dashboardQ.data?.data?.events ?? []) as AnyRecord[];
  const ticketTypes = (ticketTypesQ.data?.data ?? []) as AnyRecord[];

  const createMutation = useMutation({
    mutationFn: async () => {
      const t = await token();
      return api.createTicketType(t, {
        eventId:  form.eventId,
        name:     form.name,
        kind:     form.kind,
        price:    parseFloat(form.price),
        currency: form.currency,
        quantity: parseInt(form.quantity, 10)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizer-ticket-types"] });
      setShowForm(false);
      setForm({ eventId: "", name: "", kind: "REGULAR", price: "", currency: "GHS", quantity: "" });
    }
  });

  const field = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (ticketTypesQ.isPending) return <LoadingGrid cols={2} />;
  if (ticketTypesQ.isError) return <ErrorState message={ticketTypesQ.error.message} onRetry={ticketTypesQ.refetch} />;

  const canSubmit = Boolean(form.eventId && form.name && form.price && form.quantity) && !createMutation.isPending;

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-vr-muted">
          {ticketTypes.length} ticket type{ticketTypes.length !== 1 ? "s" : ""} across your events
        </p>
        <Button variant="primary" size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" />
          New ticket type
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-vr-gold/30 bg-vr-card p-5">
          <h3 className="mb-4 font-semibold text-vr-text">New ticket type</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-vr-muted">Event</label>
              <select
                className="h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text outline-none focus:border-vr-gold"
                value={form.eventId}
                onChange={(e) => field("eventId", e.target.value)}
              >
                <option value="">Select event…</option>
                {events.map((event) => (
                  <option key={String(event.id)} value={String(event.id)}>
                    {String(event.title)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-vr-muted">Name</label>
              <input
                className="h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
                placeholder="e.g. Early Bird VIP"
                value={form.name}
                onChange={(e) => field("name", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-vr-muted">Kind</label>
              <select
                className="h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text outline-none focus:border-vr-gold"
                value={form.kind}
                onChange={(e) => field("kind", e.target.value)}
              >
                {["REGULAR", "VIP", "VVIP", "TABLE"].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-vr-muted">Price (GHS)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => field("price", e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-vr-muted">Quantity</label>
              <input
                type="number"
                min="1"
                className="h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none focus:border-vr-gold"
                placeholder="100"
                value={form.quantity}
                onChange={(e) => field("quantity", e.target.value)}
              />
            </div>
          </div>

          {createMutation.isError && (
            <p className="mt-3 text-sm text-vr-danger">{createMutation.error.message}</p>
          )}

          <div className="mt-5 flex gap-3">
            <Button disabled={!canSubmit} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? "Creating…" : "Create ticket type"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {ticketTypes.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No ticket types yet"
          description="Add ticket types to your events so attendees can purchase tickets."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {ticketTypes.map((tt) => (
            <div key={String(tt.id)} className="rounded-xl border border-vr-border bg-vr-card p-5 transition-all hover:border-vr-gold/30">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-vr-text">{String(tt.name)}</p>
                  <p className="mt-0.5 truncate text-xs text-vr-muted">{String(tt.eventTitle)}</p>
                </div>
                <Badge
                  variant={
                    String(tt.kind) === "REGULAR" ? "default" :
                    String(tt.kind) === "VIP"     ? "purple"  : "gold"
                  }
                >
                  {String(tt.kind)}
                </Badge>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <p className="text-xl font-bold text-vr-gold">
                  {String(tt.currency)} {Number(tt.price).toFixed(2)}
                </p>
                <p className="text-sm text-vr-muted">
                  {Number(tt.soldQuantity)}/{Number(tt.quantity)} sold
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
