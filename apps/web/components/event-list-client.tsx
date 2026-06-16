"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EventCard } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";

const filters = [
  { value: "all",       label: "All" },
  { value: "live",      label: "Live now" },
  { value: "upcoming",  label: "Upcoming" },
  { value: "tomorrow",  label: "Tomorrow" },
  { value: "next-week", label: "Next week" },
  { value: "popular",   label: "Popular" }
];

export function EventListClient({ compact = false }: { compact?: boolean }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (filter !== "all") params.set("filter", filter);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [filter, search]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["events", queryString],
    queryFn:  () => api.events(queryString)
  });

  const events = data?.data ?? [];
  const shown  = compact ? events.slice(0, 8) : events;

  return (
    <>
      {/* Header + search */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className={compact ? "text-2xl font-bold text-vr-text" : "text-3xl font-bold text-vr-text"}>
            {compact ? "Featured events" : "Discover events"}
          </h2>
          <p className="mt-1.5 text-sm text-vr-muted">
            Search professional experiences, private lists, tables, and VIP access.
          </p>
        </div>

        <form
          className="flex overflow-hidden rounded-xl border border-vr-border bg-vr-card"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex min-w-0 items-center gap-2 px-3">
            <Search className="size-4 shrink-0 text-vr-muted" />
            <input
              className="h-10 w-52 bg-transparent text-sm text-vr-text placeholder:text-vr-muted outline-none"
              placeholder="Search events, cities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" className="m-1">
            Search
          </Button>
        </form>
      </div>

      {/* Filter chips */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all ${
              filter === value
                ? "border-vr-gold bg-vr-gold/10 text-vr-gold"
                : "border-vr-border bg-vr-card text-vr-muted hover:border-vr-gold/30 hover:text-vr-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Organizer prompt */}
      {/organizer|organise|organize|manage|create/i.test(search) && (
        <div className="mb-6 rounded-xl border border-vr-purple/30 bg-vr-purple/10 p-4">
          <h3 className="font-semibold text-vr-text">Organizer tools</h3>
          <p className="mt-1 text-sm text-vr-muted">
            Log in with an organizer account to create events, manage tickets, staff, vendors, seating, and analytics.
          </p>
        </div>
      )}

      {/* States */}
      {isLoading && <EventGridSkeleton />}

      {isError && (
        <EmptyState
          title="Failed to load events"
          description={error instanceof Error ? error.message : "Something went wrong."}
        />
      )}

      {/* Event grid */}
      {!isLoading && !isError && (
        <>
          {shown.length === 0 ? (
            <EmptyState
              title="No events found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {shown.map((event) => (
                <EventCard
                  key={event.id}
                  href={`/events/${event.slug}`}
                  title={event.title}
                  meta={`${event.isLive ? "Live now" : event.venueName} · ${new Date(event.startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                  price={
                    event.minPrice === Infinity
                      ? "Invite only"
                      : `${event.currency} ${event.minPrice.toLocaleString()}`
                  }
                  imageUrl={event.bannerUrl}
                />
              ))}
            </div>
          )}

          {compact && events.length > 8 && (
            <div className="mt-8 text-center">
              <a href="/events">
                <Button variant="secondary">View all events</Button>
              </a>
            </div>
          )}
        </>
      )}
    </>
  );
}

function EventGridSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-vr-border bg-vr-card overflow-hidden">
          <Skeleton className="aspect-[16/9] rounded-none" />
          <div className="p-4 grid gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
