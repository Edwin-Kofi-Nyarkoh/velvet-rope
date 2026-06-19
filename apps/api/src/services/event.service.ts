import { Prisma } from "@prisma/client";
import { createEventSchema, createTicketTypeSchema } from "@velvet-rope/shared";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const eventService = {
  async list(query: { search?: string; category?: string; city?: string; filter?: string; sort?: string }) {
    const now = new Date();
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const where: Prisma.EventWhereInput = {
      status: "PUBLISHED",
      isPrivate: false,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.filter === "ongoing" || query.filter === "live" ? { startsAt: { lte: now }, endsAt: { gte: now } } : {}),
      ...(query.filter === "tomorrow" ? { startsAt: { gte: tomorrowStart, lt: tomorrowEnd } } : {}),
      ...(query.filter === "upcoming" ? { startsAt: { gt: now } } : {}),
      ...(query.filter === "next-week" ? { startsAt: { gt: now, lte: nextWeek } } : {}),
      ...(query.filter === "popular" ? { OR: [{ isPopular: true }, { popularityScore: { gt: 0 } }] } : {})
    };

    const byPopularity = query.sort === "popular" || query.filter === "popular";
    const events = await prisma.event.findMany({
      where,
      include: { category: true, ticketTypes: true },
      orderBy: byPopularity
        ? [{ popularityScore: "desc" }, { viewCount: "desc" }, { startsAt: "asc" }]
        : query.filter === "ongoing" || query.filter === "live"
          ? [{ popularityScore: "desc" }, { startsAt: "asc" }]
          : [{ startsAt: "asc" }],
      take: 40
    });

    return events.map((event) => {
      const prices = event.ticketTypes.map((type) => Number(type.price));
      const ticketsSold = event.ticketTypes.reduce((sum, type) => sum + type.soldQuantity, 0);
      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        bannerUrl: event.bannerUrl,
        category: event.category.name,
        venueName: event.venueName,
        city: event.city,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        minPrice: prices.length ? Math.min(...prices) : 0,
        currency: event.ticketTypes[0]?.currency ?? "GHS",
        isPrivate: event.isPrivate,
        isLive: event.startsAt <= now && event.endsAt >= now,
        isOngoing: event.startsAt <= now && event.endsAt >= now,
        isPopular: event.isPopular || ticketsSold >= 20,
        popularityScore: event.popularityScore,
        ticketsSold
      };
    });
  },

  async detail(slug: string) {
    const event = await prisma.event.update({
      where: { slug },
      data: { viewCount: { increment: 1 }, popularityScore: { increment: 1 } },
      include: { category: true, ticketTypes: true, organizer: { select: { id: true, email: true, profile: { select: { fullName: true, avatarUrl: true } } } }, tables: true, seats: true }
    }).catch(() => null);
    if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
    return event;
  },

  async create(organizerId: string, input: unknown) {
    const data = createEventSchema.parse(input);
    const slug = `${slugify(data.title)}-${Date.now().toString(36)}`;
    return prisma.event.create({
      data: {
        ...data,
        slug,
        organizerId,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        status: "DRAFT"
      }
    });
  },

  async createTicketType(organizerId: string, input: unknown) {
    const data = createTicketTypeSchema.parse(input);
    const event = await prisma.event.findFirst({ where: { id: data.eventId, organizerId } });
    if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found or not owned by you.");
    return prisma.ticketType.create({
      data: {
        ...data,
        price: new Prisma.Decimal(data.price),
        salesStartAt: data.salesStartAt ? new Date(data.salesStartAt) : undefined,
        salesEndAt: data.salesEndAt ? new Date(data.salesEndAt) : undefined
      }
    });
  }
};
