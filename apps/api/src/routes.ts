import { Router } from "express";
import { Role } from "@prisma/client";
import { invitationSchema } from "@velvet-rope/shared";
import QRCode from "qrcode";
import { authLimiter, authSpeedLimiter, writeLimiter } from "./middleware/security";
import { requireAuth, requireRole, type AuthRequest } from "./middleware/auth";
import { AppError, asyncHandler, sendData } from "./lib/http";
import { prisma } from "./lib/prisma";
import { authService } from "./services/auth.service";
import { eventService } from "./services/event.service";
import { paymentService } from "./services/payment.service";
import { checkInService } from "./services/checkin.service";
import { analyticsService } from "./services/analytics.service";
import { cloudinaryService } from "./services/cloudinary.service";
import { emailService } from "./services/email.service";
import { platformService } from "./services/platform.service";
import { nanoid } from "nanoid";

export const apiRouter = Router();

const param = (value: string | string[] | undefined, fallback = "") => (Array.isArray(value) ? value[0] ?? fallback : value ?? fallback);

apiRouter.get("/health", (_req, res) => sendData(res, { ok: true, name: "Velvet Rope API" }));

apiRouter.get("/calendar/events/:id", asyncHandler(async (req, res) => {
  const calendar = await platformService.calendarEvent(param(req.params.id));
  if (req.query.download === "1") {
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${calendar.filename}"`);
    res.send(calendar.ics);
    return;
  }
  sendData(res, calendar);
}));

apiRouter.post("/auth/register", authLimiter, authSpeedLimiter, asyncHandler(async (req, res) => sendData(res, await authService.register(req.body), 201)));
apiRouter.post("/auth/login", authLimiter, authSpeedLimiter, asyncHandler(async (req, res) => sendData(res, await authService.login(req.body))));
apiRouter.post("/auth/refresh", authLimiter, asyncHandler(async (req, res) => sendData(res, await authService.refresh(req.body.refreshToken))));
apiRouter.post("/auth/verify-email", authLimiter, authSpeedLimiter, asyncHandler(async (req, res) => sendData(res, await authService.verifyEmail(req.body))));
apiRouter.post("/auth/logout", requireAuth, asyncHandler(async (req, res) => {
  await prisma.user.update({ where: { id: (req as AuthRequest).user.id }, data: { tokenVersion: { increment: 1 } } });
  sendData(res, { message: "Logged out successfully." });
}));
apiRouter.post("/auth/forgot-password", authLimiter, authSpeedLimiter, asyncHandler(async (req, res) => sendData(res, await authService.forgotPassword(req.body.email ?? ""))));
apiRouter.post("/auth/reset-password", authLimiter, asyncHandler(async (req, res) => sendData(res, await authService.resetPassword(req.body.token ?? "", req.body.password ?? ""))));

apiRouter.get("/users/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: (req as AuthRequest).user.id },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      profile: true
    }
  });
  sendData(res, user);
}));
apiRouter.patch("/users/me", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  const data = {
    fullName: typeof req.body.fullName === "string" ? req.body.fullName.trim().slice(0, 120) : undefined,
    phone: typeof req.body.phone === "string" ? req.body.phone.trim().slice(0, 40) : undefined,
    city: typeof req.body.city === "string" ? req.body.city.trim().slice(0, 120) : undefined,
    country: typeof req.body.country === "string" ? req.body.country.trim().slice(0, 120) : undefined
  };
  const userId = (req as AuthRequest).user.id;
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      profile: {
        upsert: {
          create: { fullName: data.fullName || (req as AuthRequest).user.email, phone: data.phone, city: data.city, country: data.country },
          update: data
        }
      }
    },
    include: { profile: true }
  });
  sendData(res, { id: user.id, email: user.email, role: user.role, fullName: user.profile?.fullName ?? user.email, profile: user.profile });
}));

apiRouter.get("/dashboard/attendee", requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await platformService.attendeeDashboard((req as AuthRequest).user.id));
}));
apiRouter.get("/dashboard/organizer", requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await platformService.organizerDashboard((req as AuthRequest).user));
}));

apiRouter.get("/events", asyncHandler(async (req, res) => sendData(res, await eventService.list(req.query as Record<string, string>))));
apiRouter.get("/events/:slug", asyncHandler(async (req, res) => sendData(res, await eventService.detail(param(req.params.slug)))));
apiRouter.get("/event-categories", asyncHandler(async (_req, res) => sendData(res, await prisma.eventCategory.findMany({ orderBy: { name: "asc" } }))));
apiRouter.post("/events", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await eventService.create((req as AuthRequest).user.id, req.body), 201);
}));
apiRouter.patch("/events/:id", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const event = await prisma.event.findFirst({
    where: {
      id: param(req.params.id),
      ...((req as AuthRequest).user.role === Role.ORGANIZER ? { organizerId: (req as AuthRequest).user.id } : {})
    }
  });
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
  const allowed = ["title", "description", "bannerUrl", "venueName", "address", "city", "country", "isPrivate", "isSeries", "categoryId"] as const;
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in req.body) data[key] = req.body[key];
  }
  if (req.body.startsAt) {
    const d = new Date(String(req.body.startsAt));
    if (isNaN(d.getTime())) throw new AppError(422, "INVALID_DATE", "startsAt is not a valid date.");
    data.startsAt = d;
  }
  if (req.body.endsAt) {
    const d = new Date(String(req.body.endsAt));
    if (isNaN(d.getTime())) throw new AppError(422, "INVALID_DATE", "endsAt is not a valid date.");
    data.endsAt = d;
  }
  sendData(res, await prisma.event.update({ where: { id: event.id }, data, include: { category: true, ticketTypes: true } }));
}));
apiRouter.delete("/events/:id", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const event = await prisma.event.findFirst({
    where: {
      id: param(req.params.id),
      ...((req as AuthRequest).user.role === Role.ORGANIZER ? { organizerId: (req as AuthRequest).user.id } : {})
    }
  });
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
  await prisma.event.update({ where: { id: event.id }, data: { status: "CANCELLED" } });
  sendData(res, { message: "Event cancelled." });
}));
apiRouter.patch("/events/:id/popularity", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const event = await prisma.event.findFirst({
    where: {
      id: param(req.params.id),
      ...((req as AuthRequest).user.role === Role.ORGANIZER ? { organizerId: (req as AuthRequest).user.id } : {})
    }
  });
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
  sendData(res, await prisma.event.update({ where: { id: event.id }, data: { isPopular: Boolean(req.body.isPopular), isFeatured: Boolean(req.body.isFeatured ?? event.isFeatured) } }));
}));
apiRouter.post("/tickets/types", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await eventService.createTicketType((req as AuthRequest).user.id, req.body), 201);
}));

apiRouter.get("/tickets/me", requireAuth, asyncHandler(async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { userId: (req as AuthRequest).user.id },
    include: { event: true, ticketType: true, user: { include: { profile: true } }, nfcCredential: true, seat: { include: { table: true } } },
    orderBy: { issuedAt: "desc" }
  });
  sendData(res, await Promise.all(tickets.map(async (ticket) => ({
    id: ticket.id,
    eventTitle: ticket.event.title,
    attendeeName: ticket.user.profile?.fullName ?? ticket.user.email,
    ticketType: ticket.ticketType.kind,
    qrCodePayload: ticket.qrCodePayload,
    qrCodeDataUrl: await QRCode.toDataURL(ticket.qrCodePayload, { margin: 1, width: 280 }),
    nfcToken: ticket.nfcCredential?.token ?? null,
    seat: ticket.seat ? { label: ticket.seat.label, table: ticket.seat.table?.name ?? null, zone: ticket.seat.table?.zone ?? null } : null,
    status: ticket.status,
    startsAt: ticket.event.startsAt.toISOString()
  }))));
}));

apiRouter.post("/payments/initialize", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthRequest).user;
  sendData(res, await paymentService.initialize(user.id, user.email, req.body), 201);
}));
apiRouter.post("/payments/verify", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  const reference = String(req.body.reference ?? "");
  if (!reference) throw new AppError(422, "MISSING_REFERENCE", "Payment reference is required.");
  const order = await prisma.order.findUnique({ where: { reference }, select: { userId: true } });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  const caller = (req as AuthRequest).user;
  if (order.userId !== caller.id && caller.role !== Role.ADMIN && caller.role !== Role.SUPER_ADMIN) {
    throw new AppError(403, "FORBIDDEN", "You cannot verify this payment.");
  }
  sendData(res, await paymentService.verify(reference));
}));

apiRouter.post("/checkins/validate", writeLimiter, requireAuth, requireRole(Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await checkInService.validate((req as AuthRequest).user.id, req.body));
}));
apiRouter.post("/checkins/nfc/validate", writeLimiter, requireAuth, requireRole(Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await checkInService.validateNfc((req as AuthRequest).user.id, req.body));
}));

apiRouter.post("/invitations", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthRequest).user;
  const data = invitationSchema.parse(req.body);
  const event = await prisma.event.findUnique({ where: { id: data.eventId } });
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
  if (user.role === Role.ORGANIZER && event.organizerId !== user.id) {
    throw new AppError(403, "FORBIDDEN", "You do not own this event.");
  }
  const invitation = await prisma.invitation.create({
    data: {
      ...data,
      sentById: (req as AuthRequest).user.id,
      token: nanoid(32),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    }
  });
  const sender = await prisma.user.findUnique({ where: { id: (req as AuthRequest).user.id }, include: { profile: true } });
  emailService.sendInvitation({
    email: invitation.email,
    recipientName: invitation.recipientName,
    senderName: sender?.profile?.fullName ?? sender?.email ?? "A Velvet Rope user",
    eventTitle: event.title,
    message: invitation.message ?? undefined,
    token: invitation.token
  }).catch((error) => console.error("Invitation email failed", error));
  sendData(res, invitation, 201);
}));
apiRouter.get("/invitations/me", requireAuth, asyncHandler(async (req, res) => {
  const user = (req as AuthRequest).user;
  const invitations = await prisma.invitation.findMany({
    where: { OR: [{ inviteeId: user.id }, { email: user.email }] },
    include: { event: true, sentBy: { include: { profile: true } } },
    orderBy: { createdAt: "desc" }
  });
  sendData(res, invitations.map((invitation) => ({
    id: invitation.id,
    token: invitation.token,
    eventId: invitation.eventId,
    eventTitle: invitation.event.title,
    sender: invitation.sentBy.profile?.fullName ?? invitation.sentBy.email,
    status: invitation.status,
    message: invitation.message,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString()
  })));
}));
apiRouter.post("/invitations/:token/respond", authLimiter, asyncHandler(async (req, res) => {
  const invToken = param(req.params.token);
  const invitation = await prisma.invitation.findUnique({ where: { token: invToken } });
  if (!invitation) throw new AppError(404, "INVITATION_NOT_FOUND", "Invitation not found or has expired.");
  if (invitation.expiresAt < new Date()) throw new AppError(410, "INVITATION_EXPIRED", "This invitation has expired.");
  if (invitation.status !== "PENDING") throw new AppError(409, "ALREADY_RESPONDED", "This invitation has already been responded to.");
  const status = req.body.status === "ACCEPTED" ? "ACCEPTED" : "DECLINED";
  sendData(res, await prisma.invitation.update({ where: { id: invitation.id }, data: { status, respondedAt: new Date() } }));
}));

apiRouter.get("/social/friends-attending", requireAuth, asyncHandler(async (req, res) => {
  const eventId = param(req.query.eventId as string | undefined);
  if (!eventId) throw new AppError(400, "EVENT_REQUIRED", "eventId is required.");
  sendData(res, await platformService.friendsAttending((req as AuthRequest).user.id, eventId));
}));
apiRouter.post("/social/accounts", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await platformService.upsertSocialAccount((req as AuthRequest).user.id, req.body), 201);
}));
apiRouter.get("/social/hashtag-analytics", requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await platformService.hashtagAnalytics((req as AuthRequest).user, param(req.query.eventId as string | undefined, "") || undefined));
}));
apiRouter.get("/vip/verification", requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await platformService.getVipVerification((req as AuthRequest).user.id));
}));
apiRouter.post("/vip/verification", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await platformService.submitVipVerification((req as AuthRequest).user.id, req.body), 201);
}));
apiRouter.get("/seating/me", requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await platformService.seatingMe((req as AuthRequest).user.id));
}));
apiRouter.get("/seating/events/:eventId", requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await platformService.seatingForOrganizer((req as AuthRequest).user, param(req.params.eventId)));
}));
apiRouter.get("/seating/events", requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await platformService.seatingForOrganizer((req as AuthRequest).user));
}));
apiRouter.post("/seating/assign", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await platformService.assignSeat((req as AuthRequest).user, req.body));
}));
apiRouter.get("/vendor-transactions", requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await platformService.vendorTransactions((req as AuthRequest).user));
}));
apiRouter.post("/vendor-transactions", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await platformService.createVendorTransaction((req as AuthRequest).user, req.body), 201);
}));
apiRouter.post("/vendor-transactions/:id/confirm", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await platformService.confirmVendorTransaction((req as AuthRequest).user, param(req.params.id)));
}));
apiRouter.get("/communications", requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await platformService.communications((req as AuthRequest).user));
}));
apiRouter.post("/communications", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await platformService.createCommunication((req as AuthRequest).user, req.body), 201);
}));

apiRouter.patch("/users/me/password", authLimiter, requireAuth, asyncHandler(async (req, res) => {
  sendData(res, await authService.changePassword(
    (req as AuthRequest).user.id,
    req.body.currentPassword ?? "",
    req.body.newPassword ?? ""
  ));
}));

apiRouter.get("/notifications/unread-count", requireAuth, asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({ where: { userId: (req as AuthRequest).user.id, readAt: null } });
  sendData(res, { count });
}));
apiRouter.patch("/notifications/read-all", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: (req as AuthRequest).user.id, readAt: null }, data: { readAt: new Date() } });
  sendData(res, { message: "All notifications marked as read." });
}));
apiRouter.get("/notifications", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as AuthRequest).user.id;
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);
  sendData(res, notifications, 200, { unreadCount });
}));
apiRouter.patch("/notifications/:id/read", writeLimiter, requireAuth, asyncHandler(async (req, res) => {
  const notification = await prisma.notification.findFirst({ where: { id: param(req.params.id), userId: (req as AuthRequest).user.id } });
  if (!notification) throw new AppError(404, "NOT_FOUND", "Notification not found.");
  sendData(res, await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } }));
}));

apiRouter.get("/staff", requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const where = (req as AuthRequest).user.role === Role.ORGANIZER ? { event: { organizerId: (req as AuthRequest).user.id } } : {};
  sendData(res, await prisma.staffPermission.findMany({ where, include: { user: { select: { id: true, email: true, role: true, profile: { select: { fullName: true, avatarUrl: true } } } }, event: true } }));
}));
apiRouter.post("/staff", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const { userId, email: userEmail, eventId, canScanTickets = true, canManageGuests = false, canViewRevenue = false, canManageVendors = false } = req.body as Record<string, unknown>;
  if ((!userId && !userEmail) || !eventId) throw new AppError(422, "MISSING_FIELDS", "userId or email, and eventId are required.");
  const event = await prisma.event.findFirst({
    where: { id: String(eventId), ...((req as AuthRequest).user.role === Role.ORGANIZER ? { organizerId: (req as AuthRequest).user.id } : {}) }
  });
  if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
  const staffUser = userId
    ? await prisma.user.findUnique({ where: { id: String(userId) } })
    : await prisma.user.findUnique({ where: { email: String(userEmail) } });
  if (!staffUser) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  const resolvedStaffId = staffUser.id;
  const permission = await prisma.staffPermission.upsert({
    where: { userId_eventId: { userId: resolvedStaffId, eventId: String(eventId) } },
    create: { userId: resolvedStaffId, eventId: String(eventId), canScanTickets: Boolean(canScanTickets), canManageGuests: Boolean(canManageGuests), canViewRevenue: Boolean(canViewRevenue), canManageVendors: Boolean(canManageVendors) },
    update: { canScanTickets: Boolean(canScanTickets), canManageGuests: Boolean(canManageGuests), canViewRevenue: Boolean(canViewRevenue), canManageVendors: Boolean(canManageVendors) },
    include: { user: { select: { id: true, email: true, role: true, profile: { select: { fullName: true, avatarUrl: true } } } }, event: true }
  });
  if (staffUser.role === Role.ATTENDEE || staffUser.role === Role.GUEST) {
    await prisma.user.update({ where: { id: staffUser.id }, data: { role: Role.STAFF } });
  }
  sendData(res, permission, 201);
}));
apiRouter.patch("/staff/:id", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const permission = await prisma.staffPermission.findFirst({
    where: { id: param(req.params.id), ...((req as AuthRequest).user.role === Role.ORGANIZER ? { event: { organizerId: (req as AuthRequest).user.id } } : {}) }
  });
  if (!permission) throw new AppError(404, "NOT_FOUND", "Staff permission not found.");
  const data: Record<string, boolean> = {};
  for (const key of ["canScanTickets", "canManageGuests", "canViewRevenue", "canManageVendors"] as const) {
    if (typeof req.body[key] === "boolean") data[key] = req.body[key] as boolean;
  }
  sendData(res, await prisma.staffPermission.update({ where: { id: permission.id }, data, include: { user: { select: { id: true, email: true, role: true, profile: { select: { fullName: true, avatarUrl: true } } } }, event: true } }));
}));
apiRouter.delete("/staff/:id", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const permission = await prisma.staffPermission.findFirst({
    where: { id: param(req.params.id), ...((req as AuthRequest).user.role === Role.ORGANIZER ? { event: { organizerId: (req as AuthRequest).user.id } } : {}) }
  });
  if (!permission) throw new AppError(404, "NOT_FOUND", "Staff permission not found.");
  await prisma.staffPermission.delete({ where: { id: permission.id } });
  sendData(res, { message: "Staff removed." });
}));

apiRouter.get("/vendors", requireAuth, asyncHandler(async (req, res) => {
  const where = (req as AuthRequest).user.role === Role.ORGANIZER ? { event: { organizerId: (req as AuthRequest).user.id } } : {};
  sendData(res, await prisma.vendor.findMany({ where, include: { user: { select: { id: true, email: true, role: true, profile: { select: { fullName: true, avatarUrl: true } } } }, event: true } }));
}));
apiRouter.post("/vendors", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const { userId, email: userEmail, eventId, businessName, category, description, phone, email } = req.body as Record<string, unknown>;
  if ((!userId && !userEmail) || !businessName || !category) throw new AppError(422, "MISSING_FIELDS", "userId or email, businessName, and category are required.");
  if (eventId) {
    const event = await prisma.event.findFirst({
      where: { id: String(eventId), ...((req as AuthRequest).user.role === Role.ORGANIZER ? { organizerId: (req as AuthRequest).user.id } : {}) }
    });
    if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event not found.");
  }
  const vendorUser = userId
    ? await prisma.user.findUnique({ where: { id: String(userId) } })
    : await prisma.user.findUnique({ where: { email: String(userEmail) } });
  if (!vendorUser) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  const resolvedUserId = vendorUser.id;
  const vendor = await prisma.vendor.upsert({
    where: { userId: resolvedUserId },
    create: { userId: resolvedUserId, eventId: eventId ? String(eventId) : undefined, businessName: String(businessName), category: String(category), description: description ? String(description) : undefined, phone: phone ? String(phone) : undefined, email: email ? String(email) : undefined },
    update: { eventId: eventId ? String(eventId) : undefined, businessName: String(businessName), category: String(category), description: description ? String(description) : undefined, phone: phone ? String(phone) : undefined, email: email ? String(email) : undefined },
    include: { user: { select: { id: true, email: true, role: true, profile: { select: { fullName: true, avatarUrl: true } } } }, event: true }
  });
  if (vendorUser.role === Role.ATTENDEE || vendorUser.role === Role.GUEST) {
    await prisma.user.update({ where: { id: vendorUser.id }, data: { role: Role.VENDOR } });
  }
  sendData(res, vendor, 201);
}));
apiRouter.patch("/vendors/:id", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const user = (req as AuthRequest).user;
  const vendor = await prisma.vendor.findFirst({
    where: {
      id: param(req.params.id),
      ...(user.role === Role.ORGANIZER ? { event: { organizerId: user.id } } : {})
    }
  });
  if (!vendor) throw new AppError(404, "NOT_FOUND", "Vendor not found.");
  const data: Record<string, unknown> = {};
  for (const key of ["businessName", "category", "description", "phone", "email", "eventId"]) {
    if (key in req.body) data[key] = req.body[key];
  }
  sendData(res, await prisma.vendor.update({ where: { id: vendor.id }, data, include: { user: { select: { id: true, email: true, role: true, profile: { select: { fullName: true, avatarUrl: true } } } }, event: true } }));
}));
apiRouter.delete("/vendors/:id", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const user = (req as AuthRequest).user;
  const vendor = await prisma.vendor.findFirst({
    where: {
      id: param(req.params.id),
      ...(user.role === Role.ORGANIZER ? { event: { organizerId: user.id } } : {})
    }
  });
  if (!vendor) throw new AppError(404, "NOT_FOUND", "Vendor not found.");
  await prisma.vendor.delete({ where: { id: vendor.id } });
  sendData(res, { message: "Vendor removed." });
}));
apiRouter.get("/orders", requireAuth, asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: (req as AuthRequest).user.id },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true, startsAt: true, bannerUrl: true } },
      tickets: { select: { id: true, code: true, status: true, ticketType: { select: { name: true, kind: true } } } }
    }
  });
  sendData(res, orders.map((order) => ({
    id: order.id,
    reference: order.reference,
    status: order.status,
    totalAmount: Number(order.amount),
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    event: order.event,
    tickets: order.tickets.map((t) => ({
      id: t.id,
      code: t.code,
      status: t.status,
      ticketType: t.ticketType.kind,
      ticketTypeName: t.ticketType.name
    }))
  })));
}));
apiRouter.get("/organizer/attendees", requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const user = (req as AuthRequest).user;
  const eventWhere = user.role === Role.ORGANIZER ? { event: { organizerId: user.id } } : {};
  const tickets = await prisma.ticket.findMany({
    where: eventWhere,
    include: { user: { include: { profile: true } }, event: true, ticketType: true },
    orderBy: { issuedAt: "desc" },
    take: 200
  });
  sendData(res, tickets.map((ticket) => ({
    id: ticket.id,
    attendeeName: ticket.user.profile?.fullName ?? ticket.user.email,
    attendeeEmail: ticket.user.email,
    eventId: ticket.eventId,
    eventTitle: ticket.event.title,
    ticketType: ticket.ticketType.kind,
    status: ticket.status,
    issuedAt: ticket.issuedAt.toISOString()
  })));
}));

apiRouter.get("/tickets/types", requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  const user = (req as AuthRequest).user;
  const eventId = param(req.query.eventId as string | undefined);
  const eventWhere = user.role === Role.ORGANIZER ? { organizerId: user.id } : {};
  const ticketTypes = await prisma.ticketType.findMany({
    where: { ...(eventId ? { eventId } : {}), event: eventWhere },
    include: { event: { select: { title: true } } },
    orderBy: { createdAt: "desc" }
  });
  sendData(res, ticketTypes.map((tt) => ({
    id: tt.id,
    eventId: tt.eventId,
    eventTitle: tt.event.title,
    name: tt.name,
    kind: tt.kind,
    price: Number(tt.price),
    currency: tt.currency,
    quantity: tt.quantity,
    soldQuantity: tt.soldQuantity,
    salesStartAt: tt.salesStartAt?.toISOString() ?? null,
    salesEndAt: tt.salesEndAt?.toISOString() ?? null
  })));
}));

apiRouter.get("/analytics/overview", requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, await analyticsService.organizerOverview((req as AuthRequest).user.id));
}));
apiRouter.post("/uploads/cloudinary-signature", writeLimiter, requireAuth, requireRole(Role.ORGANIZER, Role.ADMIN, Role.SUPER_ADMIN), asyncHandler(async (req, res) => {
  sendData(res, cloudinaryService.createUploadSignature(req.body.folder));
}));
