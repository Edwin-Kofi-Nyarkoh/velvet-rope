"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWebAccessToken } from "@/lib/auth-token";
import { InviteEventForm } from "@/components/invite-event-form";
import { CalendarButton, FriendsAttendingClient } from "@/components/dashboard-clients";

export function EventDetailClient({ slug }: { slug: string }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["event", slug],
    queryFn:  () => api.event(slug)
  });

  const event       = data?.data;
  const ticketTypes = event?.ticketTypes ?? [];

  const selectedItems = ticketTypes
    .map((t) => ({ ticketTypeId: t.id, quantity: quantities[t.id] ?? 0, ticket: t }))
    .filter((i) => i.quantity > 0);

  const totalQty    = selectedItems.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = selectedItems.reduce((s, i) => s + Number(i.ticket.price) * i.quantity, 0);
  const currency    = ticketTypes[0]?.currency ?? "GHS";

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const token = await getWebAccessToken();
      if (!event)               throw new Error("Event is still loading.");
      if (!selectedItems.length) throw new Error("Select at least one ticket.");
      return api.initializePayment(token, {
        eventId: event.id,
        items:   selectedItems.map((i) => ({ ticketTypeId: i.ticketTypeId, quantity: i.quantity }))
      });
    },
    onSuccess: (result) => {
      if (!result.data.authorizationUrl) throw new Error("Checkout could not be started.");
      window.location.href = result.data.authorizationUrl;
    }
  });

  const updateQty = (id: string, next: number) =>
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, Math.min(10, next)) }));

  if (isLoading) return <EventDetailSkeleton />;
  if (isError)   return <p className="p-8 text-sm text-vr-danger">{error.message}</p>;
  if (!event)    return <p className="p-8 text-sm text-vr-muted">Event not found.</p>;

  return (
    <main className="mx-auto grid max-w-[1440px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">

      {/* Left — event info */}
      <section>
        <div className="relative aspect-[16/7] overflow-hidden rounded-2xl bg-vr-surface shadow-soft">
          <Image
            src={event.bannerUrl}
            alt={event.title}
            fill
            sizes="(min-width: 1024px) 960px, 100vw"
            className="object-cover"
            priority
          />
        </div>

        <h1 className="mt-8 text-3xl font-bold text-vr-text sm:text-4xl">{event.title}</h1>
        <p className="mt-4 max-w-3xl leading-7 text-vr-muted">{event.description}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(
            [
              [CalendarDays, new Date(event.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })],
              [MapPin,       `${event.venueName}, ${event.city}`],
              [ShieldCheck,  "Verified Paystack checkout"]
            ] as const
          ).map(([Icon, label]) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-vr-border bg-vr-card px-4 py-3 text-sm text-vr-text">
              <Icon className="size-4 shrink-0 text-vr-gold" />
              {label}
            </div>
          ))}
        </div>

        <div className="mt-5">
          <CalendarButton eventId={event.id} />
        </div>

        <FriendsAttendingClient eventId={event.id} />
        <InviteEventForm eventId={event.id} />
      </section>

      {/* Right — ticket selector */}
      <aside className="h-fit rounded-2xl border border-vr-border bg-vr-card p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-vr-text">Get tickets</h2>

        {ticketTypes.length === 0 ? (
          <p className="mt-4 rounded-lg bg-vr-surface px-3 py-2.5 text-sm text-vr-muted">
            Ticket sales have not opened yet.
          </p>
        ) : (
          ticketTypes.map((ticket) => {
            const available = ticket.quantity - ticket.soldQuantity;
            const qty       = quantities[ticket.id] ?? 0;
            return (
              <div key={ticket.id} className="mt-4 rounded-xl border border-vr-border p-4 transition-all hover:border-vr-gold/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-vr-text">{ticket.name}</p>
                    <p className="mt-0.5 text-sm text-vr-muted">
                      {ticket.currency} {Number(ticket.price).toLocaleString()} · {available} left
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-lg border border-vr-border text-vr-text transition hover:border-vr-gold/50"
                      onClick={() => updateQty(ticket.id, qty - 1)}
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-vr-text">{qty}</span>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-lg border border-vr-border text-vr-text transition hover:border-vr-gold/50 disabled:opacity-40"
                      onClick={() => updateQty(ticket.id, qty + 1)}
                      disabled={qty >= Math.min(available, 10)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Order summary */}
        <div className="mt-5 rounded-xl border border-vr-border bg-vr-surface p-4">
          <div className="flex justify-between text-sm text-vr-muted">
            <span>Tickets</span>
            <span>{totalQty}</span>
          </div>
          <div className="mt-2 flex justify-between font-bold text-vr-text">
            <span>Total</span>
            <span className="text-vr-gold">
              {currency} {totalAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {checkoutMutation.isError && (
          <div className="mt-4 rounded-lg border border-vr-danger/30 bg-vr-danger/10 px-3 py-2.5 text-sm text-vr-danger">
            {checkoutMutation.error.message}
          </div>
        )}

        <Button
          className="mt-5 w-full"
          size="lg"
          disabled={!totalQty || checkoutMutation.isPending}
          onClick={() => checkoutMutation.mutate()}
        >
          {checkoutMutation.isPending ? "Starting checkout…" : "Continue to checkout"}
        </Button>
      </aside>
    </main>
  );
}

function EventDetailSkeleton() {
  return (
    <main className="mx-auto grid max-w-[1440px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
      <section>
        <Skeleton className="aspect-[16/7] rounded-2xl" />
        <Skeleton className="mt-8 h-10 w-2/3" />
        <Skeleton className="mt-4 h-5 w-full max-w-3xl" />
        <Skeleton className="mt-2.5 h-5 w-3/4 max-w-2xl" />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      </section>
      <aside className="h-fit rounded-2xl border border-vr-border bg-vr-card p-6">
        <Skeleton className="h-6 w-28" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="mt-4 h-20 rounded-xl" />)}
        <Skeleton className="mt-5 h-20 rounded-xl" />
        <Skeleton className="mt-5 h-12 rounded-xl" />
      </aside>
    </main>
  );
}
