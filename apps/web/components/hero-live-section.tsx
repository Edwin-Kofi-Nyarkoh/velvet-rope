"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { EventSummary } from "@velvet-rope/shared";

/**
 * Hero right-panel: rotating event badge + featured event card.
 * Both driven by one shared index so badge and image always match.
 *
 * Cascade: live events → popular upcoming events → popular published events.
 */
export function HeroLiveSection() {
  const [index, setIndex] = useState(0);

  const liveQuery = useQuery({
    queryKey: ["hero-live-events"],
    queryFn:  () => api.events("?filter=live"),
    staleTime: 60_000,
    retry: 1
  });

  const upcomingQuery = useQuery({
    queryKey: ["hero-upcoming-popular"],
    queryFn:  () => api.events("?filter=upcoming&sort=popular"),
    staleTime: 60_000,
    retry: 1,
    // only run if live query finished and came back empty
    enabled: liveQuery.isSuccess && (liveQuery.data?.data?.length ?? 0) === 0
  });

  const popularQuery = useQuery({
    queryKey: ["hero-popular-events"],
    queryFn:  () => api.events("?filter=popular"),
    staleTime: 60_000,
    retry: 1,
    // only run if upcoming also came back empty
    enabled:
      upcomingQuery.isSuccess && (upcomingQuery.data?.data?.length ?? 0) === 0
  });

  const { events, label } = useMemo((): { events: EventSummary[]; label: string } => {
    const live     = liveQuery.data?.data ?? [];
    const upcoming = upcomingQuery.data?.data ?? [];
    const popular  = popularQuery.data?.data ?? [];

    if (live.length)     return { events: live,     label: "Live now"  };
    if (upcoming.length) return { events: upcoming,  label: "Upcoming"  };
    if (popular.length)  return { events: popular,   label: "Popular"   };
    return { events: [], label: "Featured" };
  }, [liveQuery.data, upcomingQuery.data, popularQuery.data]);

  const isLoading =
    liveQuery.isLoading ||
    (liveQuery.isSuccess && (liveQuery.data?.data?.length ?? 0) === 0 && upcomingQuery.isLoading) ||
    (upcomingQuery.isSuccess && (upcomingQuery.data?.data?.length ?? 0) === 0 && popularQuery.isLoading);

  useEffect(() => {
    if (events.length <= 1) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % events.length),
      5000
    );
    return () => window.clearInterval(timer);
  }, [events.length]);

  // Reset index when event list changes (e.g. from empty to populated)
  useEffect(() => { setIndex(0); }, [label]);

  const event = events[index];
  const isLive = label === "Live now";

  /* ── Loading skeleton ── */
  if (isLoading) {
    return (
      <div className="rounded-xl border border-vr-border bg-vr-surface p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-5 w-20" />
          </div>
          <div className="w-44 shrink-0">
            <div className="rounded-xl border border-vr-border bg-vr-card p-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2.5 h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-2/3" />
              <Skeleton className="mt-4 h-1 rounded-full" />
            </div>
          </div>
        </div>
        <Skeleton className="aspect-[16/9] rounded-xl" />
        <div className="mt-4 grid grid-cols-3 gap-3">
          {["a", "b", "c"].map((k) => (
            <div key={k} className="rounded-lg border border-vr-border bg-vr-card p-3">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="mt-1 h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── No events placeholder ── */
  if (!event) {
    return (
      <div className="rounded-xl border border-vr-border bg-vr-surface p-5">
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-xl border border-vr-border bg-vr-card text-center">
          <div className="size-12 rounded-full bg-vr-gold/10 flex items-center justify-center text-2xl">🎟️</div>
          <p className="text-sm font-semibold text-vr-text">Events are on the way</p>
          <p className="text-xs text-vr-muted px-4">Check back soon — new events are being added.</p>
          <Link href="/events" className="text-xs font-semibold text-vr-gold hover:underline">
            Browse all events →
          </Link>
        </div>
      </div>
    );
  }

  const timeStr = new Date(event.startsAt).toLocaleTimeString(undefined, {
    hour: "numeric", minute: "2-digit"
  });

  return (
    <div className="rounded-xl border border-vr-border bg-vr-surface p-5">

      {/* Top bar: city/label left, rotating badge right */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-vr-muted truncate">
            {isLive ? `Live in ${event.city}` : `${event.city}`}
          </p>
          <h2 className="text-base font-semibold text-vr-text truncate">{event.venueName}</h2>
        </div>

        {/* Mini event badge */}
        <Link
          href={`/events/${event.slug}`}
          className="block w-44 shrink-0 rounded-xl border border-vr-border bg-vr-card p-4 transition-all hover:border-vr-gold/40 hover:shadow-gold"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {isLive ? (
                  <>
                    <span className="size-1.5 shrink-0 rounded-full bg-vr-success animate-live-pulse" />
                    <p className="text-xs font-semibold text-vr-success">Live now</p>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-vr-gold">{label}</p>
                )}
              </div>
              <h3 className="mt-1 truncate text-sm font-semibold text-vr-text">{event.title}</h3>
            </div>
            {events.length > 1 && (
              <span className="shrink-0 rounded-full border border-vr-gold/30 bg-vr-gold/10 px-2 py-0.5 text-[10px] font-semibold text-vr-gold">
                {index + 1}/{events.length}
              </span>
            )}
          </div>
          <p className="mt-1.5 truncate text-xs text-vr-muted">
            {event.venueName}, {event.city}
          </p>
          <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-vr-border">
            <div key={`${event.id}-${index}`} className="h-full animate-livebar bg-vr-gold" />
          </div>
        </Link>
      </div>

      {/* Featured event card — updates with the carousel index */}
      <Link
        href={`/events/${event.slug}`}
        className="group block rounded-xl border border-vr-border bg-vr-card shadow-soft transition-all duration-200 hover:border-vr-gold/40 hover:shadow-gold hover:-translate-y-0.5"
      >
        <div className="relative aspect-[16/9] overflow-hidden rounded-t-xl bg-vr-surface">
          {event.bannerUrl ? (
            <Image
              key={event.id}
              src={event.bannerUrl}
              alt={event.title}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-purple-gradient opacity-40" />
          )}
          <span className="absolute right-3 top-3 rounded-full border border-vr-gold/40 bg-vr-black/80 px-2.5 py-1 text-xs font-semibold text-vr-gold backdrop-blur-sm">
            {event.currency} {event.minPrice}
          </span>
          {isLive && (
            <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-vr-success/40 bg-vr-black/80 px-2.5 py-1 text-xs font-semibold text-vr-success backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-vr-success animate-live-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-vr-text line-clamp-1">{event.title}</h3>
          <p className="mt-1 text-sm text-vr-muted line-clamp-1">
            {event.venueName} · {timeStr}
          </p>
        </div>
      </Link>

      {/* Metric strip */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {(
          [
            { label: "Paid",       value: "824" },
            { label: "Invited",    value: "196" },
            { label: "Checked in", value: "512" }
          ] as const
        ).map(({ label: l, value }) => (
          <div key={l} className="rounded-lg border border-vr-border bg-vr-card p-3">
            <div className="text-xl font-bold text-vr-gold">{value}</div>
            <div className="mt-0.5 text-xs text-vr-muted">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
