import { MessageAudience, Prisma, Role, SocialProvider, VendorTransactionStatus, VipVerificationStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { assignSeatSchema, eventMessageSchema, socialAccountSchema, vendorTransactionSchema, vipVerificationSchema } from "@velvet-rope/shared";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../middleware/auth";

const organizerRoles = new Set<Role>([Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN]);
const adminRoles = new Set<Role>([Role.ADMIN, Role.SUPER_ADMIN]);

function serializeDecimal(value: Prisma.Decimal | number | string) {
  return Number(value);
}

function canManageEvent(user: AuthUser, organizerId: string) {
  return user.id === organizerId || adminRoles.has(user.role);
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

async function assertEventManager(user: AuthUser, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, organizerId: true, title: true } });
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
  if (!organizerRoles.has(user.role) || !canManageEvent(user, event.organizerId)) {
    throw new AppError(403, "EVENT_NOT_MANAGED", "You cannot manage this event.");
  }
  return event;
}

export const platformService = {
  async attendeeDashboard(userId: string) {
    const [tickets, invitations, seats, socialAccounts, vipVerifications, vendorTransactions] = await Promise.all([
      prisma.ticket.findMany({
        where: { userId },
        include: { event: true, ticketType: true, seat: { include: { table: true } }, nfcCredential: true },
        orderBy: { issuedAt: "desc" },
        take: 6
      }),
      prisma.invitation.findMany({ where: { OR: [{ inviteeId: userId }, { invitee: { id: userId } }] }, include: { event: true }, orderBy: { createdAt: "desc" }, take: 6 }),
      prisma.seat.findMany({ where: { ticket: { userId } }, include: { table: true, event: true, ticket: { include: { ticketType: true } } } }),
      prisma.socialAccount.findMany({ where: { userId }, orderBy: { provider: "asc" } }),
      prisma.vipVerification.findMany({ where: { userId }, orderBy: { submittedAt: "desc" }, take: 4 }),
      prisma.vendorTransaction.findMany({ where: { attendeeId: userId }, include: { event: true, vendor: true }, orderBy: { createdAt: "desc" }, take: 5 })
    ]);

    return {
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        eventTitle: ticket.event.title,
        ticketType: ticket.ticketType.kind,
        status: ticket.status,
        startsAt: ticket.event.startsAt.toISOString(),
        nfcEnabled: Boolean(ticket.nfcCredential?.active),
        seat: ticket.seat ? { label: ticket.seat.label, table: ticket.seat.table?.name ?? null, zone: ticket.seat.table?.zone ?? null } : null
      })),
      invitations: invitations.map((invitation) => ({
        id: invitation.id,
        eventTitle: invitation.event.title,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString()
      })),
      seats: seats.map((seat) => ({
        id: seat.id,
        label: seat.label,
        status: seat.status,
        eventTitle: seat.event.title,
        table: seat.table?.name ?? "General admission",
        zone: seat.table?.zone ?? "Main floor",
        ticketType: seat.ticket?.ticketType.kind ?? null
      })),
      socialAccounts,
      vipVerifications,
      vendorTransactions: vendorTransactions.map((transaction) => ({
        id: transaction.id,
        reference: transaction.reference,
        eventTitle: transaction.event.title,
        vendor: transaction.vendor.businessName,
        description: transaction.description,
        amount: serializeDecimal(transaction.amount),
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt.toISOString()
      }))
    };
  },

  async organizerDashboard(user: AuthUser) {
    const eventWhere = adminRoles.has(user.role) ? {} : { organizerId: user.id };
    const events = await prisma.event.findMany({
      where: eventWhere,
      include: { ticketTypes: true, orders: true, checkIns: true, invitations: true, vendors: true, staff: true },
      orderBy: { startsAt: "asc" },
      take: 12
    });
    const eventIds = events.map((event) => event.id);
    const [paidOrders, vendorTransactions, messages] = await Promise.all([
      prisma.order.findMany({ where: { eventId: { in: eventIds }, status: "PAID" } }),
      prisma.vendorTransaction.findMany({ where: { eventId: { in: eventIds } }, include: { vendor: true, attendee: { select: { email: true, profile: { select: { fullName: true } } } } }, orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.eventMessage.findMany({ where: { eventId: { in: eventIds } }, include: { event: true, sender: { select: { email: true, profile: { select: { fullName: true } } } } }, orderBy: { createdAt: "desc" }, take: 8 })
    ]);

    const revenue = paidOrders.reduce((sum, order) => sum + serializeDecimal(order.amount), 0);
    const ticketsSold = events.reduce((sum, event) => sum + event.ticketTypes.reduce((inner, ticketType) => inner + ticketType.soldQuantity, 0), 0);
    const checkIns = events.reduce((sum, event) => sum + event.checkIns.length, 0);

    return {
      metrics: {
        revenue,
        ticketsSold,
        checkIns,
        invitations: events.reduce((sum, event) => sum + event.invitations.length, 0),
        vendors: events.reduce((sum, event) => sum + event.vendors.length, 0),
        staff: events.reduce((sum, event) => sum + event.staff.length, 0)
      },
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        status: event.status,
        startsAt: event.startsAt.toISOString(),
        ticketsSold: event.ticketTypes.reduce((sum, ticketType) => sum + ticketType.soldQuantity, 0),
        checkIns: event.checkIns.length,
        vendors: event.vendors.length,
        staff: event.staff.length,
        isPopular: event.isPopular
      })),
      vendorTransactions: vendorTransactions.map((transaction) => ({
        id: transaction.id,
        reference: transaction.reference,
        vendor: transaction.vendor.businessName,
        attendee: transaction.attendee.profile?.fullName ?? transaction.attendee.email,
        amount: serializeDecimal(transaction.amount),
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt.toISOString()
      })),
      messages: messages.map((message) => ({
        id: message.id,
        eventTitle: message.event.title,
        sender: message.sender.profile?.fullName ?? message.sender.email,
        audience: message.audience,
        subject: message.subject,
        createdAt: message.createdAt.toISOString()
      }))
    };
  },

  async friendsAttending(userId: string, eventId: string) {
    const connections = await prisma.socialConnection.findMany({
      where: { userId },
      include: {
        friend: {
          include: {
            profile: true,
            socialAccounts: true,
            tickets: { where: { eventId }, include: { ticketType: true } },
            invitations: { where: { eventId } }
          }
        }
      }
    });

    return connections
      .filter((connection) => connection.friend.tickets.length || connection.friend.invitations.length)
      .map((connection) => ({
        id: connection.friend.id,
        provider: connection.provider,
        fullName: connection.friend.profile?.fullName ?? connection.friend.email,
        avatarUrl: connection.friend.profile?.avatarUrl ?? connection.friend.socialAccounts[0]?.avatarUrl ?? null,
        status: connection.friend.tickets.length ? "ticketed" : "invited",
        ticketType: connection.friend.tickets[0]?.ticketType.kind ?? null,
        handles: connection.friend.socialAccounts.map((account) => ({ provider: account.provider, handle: account.handle }))
      }));
  },

  async upsertSocialAccount(userId: string, input: unknown) {
    const data = socialAccountSchema.parse(input);
    const normalizedHandle = data.handle.replace(/^@/, "").toLowerCase();
    // Self-reported follower counts are never sufficient for auto-verification.
    // VIP status is set only through the manual submitVipVerification review flow.
    const vipStatus = VipVerificationStatus.UNVERIFIED;
    return prisma.socialAccount.upsert({
      where: { provider_handle: { provider: data.provider, handle: normalizedHandle } },
      update: {
        userId,
        displayName: data.displayName,
        followerCount: data.followerCount,
        vipStatus,
        verifiedAt: undefined
      },
      create: {
        userId,
        provider: data.provider,
        handle: normalizedHandle,
        displayName: data.displayName,
        followerCount: data.followerCount,
        vipStatus,
        verifiedAt: undefined
      }
    });
  },

  async getVipVerification(userId: string) {
    const [accounts, requests] = await Promise.all([
      prisma.socialAccount.findMany({ where: { userId }, orderBy: [{ vipStatus: "asc" }, { followerCount: "desc" }] }),
      prisma.vipVerification.findMany({ where: { userId }, orderBy: { submittedAt: "desc" } })
    ]);
    return { accounts, requests };
  },

  async submitVipVerification(userId: string, input: unknown) {
    const data = vipVerificationSchema.parse(input);
    const handle = data.handle.replace(/^@/, "").toLowerCase();
    const account = await prisma.socialAccount.findUnique({ where: { provider_handle: { provider: data.provider, handle } } });
    return prisma.vipVerification.create({
      data: {
        userId,
        socialAccountId: account?.id,
        provider: data.provider,
        handle,
        evidenceUrl: data.evidenceUrl,
        status: VipVerificationStatus.PENDING
      }
    });
  },

  async hashtagAnalytics(user: AuthUser, eventId?: string) {
    const eventWhere = eventId ? { id: eventId } : adminRoles.has(user.role) ? {} : { organizerId: user.id };
    if (!organizerRoles.has(user.role)) throw new AppError(403, "ANALYTICS_NOT_ALLOWED", "Organizer access is required.");
    const events = await prisma.event.findMany({ where: eventWhere, select: { id: true, title: true, organizerId: true } });
    const eventIds = events.filter((event) => adminRoles.has(user.role) || event.organizerId === user.id).map((event) => event.id);
    const mentions = await prisma.socialMention.findMany({ where: { eventId: { in: eventIds } }, include: { event: true }, orderBy: { postedAt: "desc" }, take: 50 });
    const summary = mentions.reduce<Record<string, { mentions: number; reach: number; engagement: number }>>((acc, mention) => {
      const key = `${mention.provider}:${mention.hashtag}`;
      acc[key] ??= { mentions: 0, reach: 0, engagement: 0 };
      acc[key].mentions += 1;
      acc[key].reach += mention.reach;
      acc[key].engagement += mention.engagement;
      return acc;
    }, {});
    return {
      summary: Object.entries(summary).map(([key, value]) => {
        const [provider, hashtag] = key.split(":");
        return { provider, hashtag, ...value };
      }),
      mentions: mentions.map((mention) => ({
        id: mention.id,
        eventTitle: mention.event.title,
        provider: mention.provider,
        hashtag: mention.hashtag,
        authorHandle: mention.authorHandle,
        content: mention.content,
        reach: mention.reach,
        engagement: mention.engagement,
        sentiment: mention.sentiment,
        postedAt: mention.postedAt.toISOString()
      }))
    };
  },

  async calendarEvent(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId }, include: { organizer: { select: { profile: { select: { fullName: true } } } } } });
    if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
    const uid = `${event.id}@velvetrope.app`;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Velvet Rope//Event Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(event.startsAt)}`,
      `DTEND:${formatIcsDate(event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000))}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(event.description)}`,
      `LOCATION:${escapeIcs(`${event.venueName}, ${event.address}, ${event.city}`)}`,
      `ORGANIZER;CN=${escapeIcs(event.organizer.profile?.fullName ?? "Organizer")}:MAILTO:noreply@velvetrope.app`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    return { filename: `${event.slug}.ics`, ics };
  },

  async seatingMe(userId: string) {
    const seats = await prisma.seat.findMany({
      where: { ticket: { userId } },
      include: { table: true, event: true, ticket: { include: { ticketType: true } } },
      orderBy: { label: "asc" }
    });
    return seats.map((seat) => ({
      id: seat.id,
      label: seat.label,
      status: seat.status,
      eventTitle: seat.event.title,
      venueName: seat.event.venueName,
      table: seat.table?.name ?? "General admission",
      zone: seat.table?.zone ?? "Main floor",
      route: [`Enter ${seat.table?.zone ?? "Main gate"}`, "Show QR or NFC pass", `Proceed to ${seat.table?.name ?? seat.label}`, `Seat ${seat.label}`],
      ticketType: seat.ticket?.ticketType.kind ?? null
    }));
  },

  async seatingForOrganizer(user: AuthUser, eventId?: string) {
    const eventWhere = eventId ? { id: eventId } : adminRoles.has(user.role) ? {} : { organizerId: user.id };
    const events = await prisma.event.findMany({
      where: eventWhere,
      include: {
        tables: { include: { seats: { include: { ticket: { include: { user: { select: { email: true, profile: { select: { fullName: true } } } }, ticketType: true } } } } } },
        seats: { include: { table: true, ticket: { include: { user: { select: { email: true, profile: { select: { fullName: true } } } }, ticketType: true } } } }
      },
      orderBy: { startsAt: "asc" }
    });
    return events
      .filter((event) => adminRoles.has(user.role) || event.organizerId === user.id)
      .map((event) => ({
        id: event.id,
        title: event.title,
        tables: event.tables.map((table) => ({
          id: table.id,
          name: table.name,
          zone: table.zone,
          capacity: table.capacity,
          assigned: table.seats.filter((seat) => seat.status === "ASSIGNED").length
        })),
        seats: event.seats.map((seat) => ({
          id: seat.id,
          label: seat.label,
          status: seat.status,
          table: seat.table?.name ?? null,
          zone: seat.table?.zone ?? null,
          attendee: seat.ticket?.user.profile?.fullName ?? seat.ticket?.user.email ?? null,
          ticketType: seat.ticket?.ticketType.kind ?? null
        }))
      }));
  },

  async assignSeat(user: AuthUser, input: unknown) {
    const data = assignSeatSchema.parse(input);
    const seat = await prisma.seat.findUnique({ where: { id: data.seatId }, include: { event: true } });
    if (!seat) throw new AppError(404, "SEAT_NOT_FOUND", "Seat not found.");
    await assertEventManager(user, seat.eventId);
    const ticket = await prisma.ticket.findUnique({ where: { id: data.ticketId } });
    if (!ticket || ticket.eventId !== seat.eventId) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found for this event.");
    const updated = await prisma.seat.update({
      where: { id: seat.id },
      data: { ticketId: ticket.id, status: "ASSIGNED" },
      include: { ticket: { include: { user: { select: { email: true, profile: { select: { fullName: true } } } } } }, table: true }
    });
    return {
      id: updated.id,
      label: updated.label,
      status: updated.status,
      table: updated.table?.name ?? null,
      zone: updated.table?.zone ?? null,
      ticketId: updated.ticketId,
      attendee: updated.ticket?.user.profile?.fullName ?? updated.ticket?.user.email ?? null
    };
  },

  async vendorTransactions(user: AuthUser) {
    const where =
      user.role === Role.VENDOR
        ? { vendor: { userId: user.id } }
        : organizerRoles.has(user.role)
          ? adminRoles.has(user.role)
            ? {}
            : { event: { organizerId: user.id } }
          : { attendeeId: user.id };
    const transactions = await prisma.vendorTransaction.findMany({
      where,
      include: { event: true, vendor: { include: { user: { select: { email: true, profile: { select: { fullName: true } } } } } }, attendee: { select: { email: true, profile: { select: { fullName: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return transactions.map((transaction) => ({
      id: transaction.id,
      reference: transaction.reference,
      eventTitle: transaction.event.title,
      vendorId: transaction.vendorId,
      vendor: transaction.vendor.businessName,
      attendee: transaction.attendee.profile?.fullName ?? transaction.attendee.email,
      description: transaction.description,
      amount: serializeDecimal(transaction.amount),
      currency: transaction.currency,
      status: transaction.status,
      createdAt: transaction.createdAt.toISOString(),
      paidAt: transaction.paidAt?.toISOString() ?? null
    }));
  },

  async createVendorTransaction(user: AuthUser, input: unknown) {
    const data = vendorTransactionSchema.parse(input);
    const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
    if (!vendor) throw new AppError(404, "VENDOR_NOT_FOUND", "Vendor not found.");
    if (vendor.eventId && vendor.eventId !== data.eventId) throw new AppError(409, "VENDOR_EVENT_MISMATCH", "Vendor is not assigned to this event.");
    return prisma.vendorTransaction.create({
      data: {
        eventId: data.eventId,
        vendorId: data.vendorId,
        attendeeId: user.id,
        reference: `VTX-${nanoid(14).toUpperCase()}`,
        description: data.description,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency,
        status: VendorTransactionStatus.PENDING
      }
    });
  },

  async confirmVendorTransaction(user: AuthUser, transactionId: string) {
    const transaction = await prisma.vendorTransaction.findUnique({ where: { id: transactionId }, include: { vendor: true, event: true } });
    if (!transaction) throw new AppError(404, "TRANSACTION_NOT_FOUND", "Vendor transaction not found.");
    const canConfirm = adminRoles.has(user.role) || transaction.event.organizerId === user.id;
    if (!canConfirm) throw new AppError(403, "TRANSACTION_NOT_ALLOWED", "You cannot confirm this vendor transaction.");
    if (transaction.status !== VendorTransactionStatus.PENDING) throw new AppError(409, "TRANSACTION_NOT_PENDING", "Only pending transactions can be confirmed.");
    return prisma.vendorTransaction.update({ where: { id: transaction.id }, data: { status: VendorTransactionStatus.PAID, paidAt: new Date() } });
  },

  async communications(user: AuthUser) {
    const eventIds =
      organizerRoles.has(user.role)
        ? (await prisma.event.findMany({ where: adminRoles.has(user.role) ? {} : { organizerId: user.id }, select: { id: true } })).map((event) => event.id)
        : user.role === Role.STAFF
          ? (await prisma.staffPermission.findMany({ where: { userId: user.id }, select: { eventId: true } })).map((permission) => permission.eventId)
          : user.role === Role.VENDOR
            ? (await prisma.vendor.findMany({ where: { userId: user.id, eventId: { not: null } }, select: { eventId: true } })).map((vendor) => vendor.eventId!).filter(Boolean)
            : [];
    const audience = user.role === Role.VENDOR ? [MessageAudience.VENDORS, MessageAudience.ALL] : user.role === Role.STAFF ? [MessageAudience.STAFF, MessageAudience.ALL] : [MessageAudience.STAFF, MessageAudience.VENDORS, MessageAudience.ALL];
    const messages = await prisma.eventMessage.findMany({
      where: { eventId: { in: eventIds }, audience: { in: audience } },
      include: { event: true, sender: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return messages.map((message) => ({
      id: message.id,
      eventTitle: message.event.title,
      sender: message.sender.profile?.fullName ?? message.sender.email,
      audience: message.audience,
      subject: message.subject,
      body: message.body,
      createdAt: message.createdAt.toISOString()
    }));
  },

  async createCommunication(user: AuthUser, input: unknown) {
    const data = eventMessageSchema.parse(input);
    await assertEventManager(user, data.eventId);
    return prisma.eventMessage.create({ data: { eventId: data.eventId, senderId: user.id, audience: data.audience, subject: data.subject, body: data.body } });
  }
};
