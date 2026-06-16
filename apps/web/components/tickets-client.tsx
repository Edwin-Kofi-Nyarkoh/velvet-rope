"use client";

import { useQuery } from "@tanstack/react-query";
import { QrCode } from "lucide-react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getWebAccessToken } from "@/lib/auth-token";

/** Displays all tickets for the authenticated attendee with their QR codes. */
export function TicketsClient() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["my-tickets"],
    queryFn:  async () => api.myTickets(await getWebAccessToken()),
    retry: false
  });

  if (isLoading) return <TicketListSkeleton />;
  if (isError)   return <p className="text-sm text-vr-danger">{error.message}</p>;

  const tickets = data?.data ?? [];

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={QrCode}
        title="No tickets yet"
        description="Buy a ticket to an event — your QR/NFC pass will appear here."
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tickets.map((ticket) => (
        <div
          key={ticket.id}
          className="rounded-xl border border-vr-border bg-vr-card p-5 transition-all hover:border-vr-gold/30"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold text-vr-text truncate">{ticket.eventTitle}</h2>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-vr-muted">{ticket.ticketType}</span>
                <Badge variant={ticket.status === "ACTIVE" ? "success" : ticket.status === "USED" ? "muted" : "danger"}>
                  {ticket.status}
                </Badge>
              </div>
            </div>

            {ticket.qrCodeDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={ticket.qrCodeDataUrl}
                alt={`${ticket.eventTitle} QR code`}
                className="size-28 shrink-0 rounded-lg border border-vr-border bg-white p-1"
              />
            ) : (
              <div className="flex size-28 shrink-0 items-center justify-center rounded-lg border border-vr-border bg-vr-surface">
                <QrCode className="size-10 text-vr-muted" />
              </div>
            )}
          </div>

          <p className="mt-4 rounded-lg bg-vr-surface px-3 py-2.5 text-xs text-vr-muted">
            Present this QR code at the gate. Staff scanning validates entry once.
          </p>
        </div>
      ))}
    </div>
  );
}

function TicketListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border border-vr-border bg-vr-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 grid gap-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="size-28 shrink-0 rounded-lg" />
          </div>
          <Skeleton className="mt-4 h-10 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
