import { checkInSchema, nfcCheckInSchema } from "@velvet-rope/shared";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";

export const checkInService = {
  async validate(staffId: string, input: unknown) {
    const data = checkInSchema.parse(input);
    return validateTicket(staffId, { qrCodePayload: data.qrCodePayload, gate: data.gate });
  },

  async validateNfc(staffId: string, input: unknown) {
    const data = nfcCheckInSchema.parse(input);
    const credential = await prisma.nfcCredential.findUnique({
      where: { token: data.nfcToken },
      include: { ticket: true }
    });
    if (!credential || !credential.active) throw new AppError(404, "NFC_NOT_FOUND", "NFC credential not found or inactive.");
    const result = await validateTicket(staffId, { ticketId: credential.ticketId, gate: data.gate });
    await prisma.nfcCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } });
    return { ...result, entryMethod: "NFC" };
  }
};

async function validateTicket(staffId: string, input: { qrCodePayload?: string; ticketId?: string; gate?: string }) {
  const ticket = await prisma.ticket.findUnique({
      where: input.ticketId ? { id: input.ticketId } : { qrCodePayload: input.qrCodePayload! },
      include: { event: true, ticketType: true, user: { include: { profile: true } }, checkIn: true }
    });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND", "Ticket not found.");
    if (ticket.status !== "ACTIVE") throw new AppError(409, "TICKET_NOT_ACTIVE", "Ticket is not active.");
    if (ticket.checkIn) throw new AppError(409, "ALREADY_CHECKED_IN", "This ticket has already been checked in.");

    const staffPermission = await prisma.staffPermission.findFirst({
      where: { userId: staffId, eventId: ticket.eventId, canScanTickets: true }
    });
    const staff = await prisma.user.findUnique({ where: { id: staffId } });
    const canScanByRole = staff?.role === "ADMIN" || staff?.role === "SUPER_ADMIN";
    if (!staffPermission && !canScanByRole) {
      throw new AppError(403, "SCAN_NOT_ALLOWED", "You are not assigned to scan this event.");
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "USED",
        usedAt: new Date(),
        checkIn: { create: { eventId: ticket.eventId, staffId, gate: input.gate } }
      }
    });

    return {
      valid: true,
      eventName: ticket.event.title,
      attendeeName: ticket.user.profile?.fullName ?? ticket.user.email,
      ticketType: ticket.ticketType.kind,
      checkedInAt: new Date().toISOString(),
      entryMethod: input.ticketId ? "NFC" : "QR"
    };
}
