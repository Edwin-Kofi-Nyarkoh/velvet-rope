import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { checkoutSchema } from "@velvet-rope/shared";
import { env } from "../env";
import { AppError } from "../lib/http";
import { prisma } from "../lib/prisma";
import { emailService } from "./email.service";

async function paystackInitialize(input: { email: string; amount: number; reference: string }) {
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: input.email,
      amount: Math.round(input.amount * 100),
      reference: input.reference,
      callback_url: env.PAYSTACK_CALLBACK_URL
    })
  });
  const payload = await response.json();
  if (!response.ok || !payload.status) throw new AppError(502, "PAYSTACK_ERROR", "Payment service is unavailable. Please try again.");
  return payload.data as { authorization_url: string; reference: string };
}

export const paymentService = {
  async initialize(userId: string, userEmail: string, input: unknown) {
    const data = checkoutSchema.parse(input);
    if (userEmail.endsWith(".test")) {
      throw new AppError(422, "PAYMENT_EMAIL_NOT_ALLOWED", "Use a real email address before starting Paystack checkout.");
    }
    const items = data.items ?? [{ ticketTypeId: data.ticketTypeId!, quantity: data.quantity! }];
    const ticketTypeIds = items.map((item) => item.ticketTypeId);
    const ticketTypes = await prisma.ticketType.findMany({ where: { id: { in: ticketTypeIds }, eventId: data.eventId } });
    if (ticketTypes.length !== ticketTypeIds.length) throw new AppError(404, "TICKET_TYPE_NOT_FOUND", "One or more ticket types were not found.");

    const ticketTypeById = new Map(ticketTypes.map((ticketType) => [ticketType.id, ticketType]));
    for (const item of items) {
      const ticketType = ticketTypeById.get(item.ticketTypeId);
      if (!ticketType) throw new AppError(404, "TICKET_TYPE_NOT_FOUND", "Ticket type not found.");
      if (ticketType.soldQuantity + item.quantity > ticketType.quantity) {
        throw new AppError(409, "SOLD_OUT", `${ticketType.name} does not have enough availability.`);
      }
    }

    const amount = items.reduce((total, item) => {
      const ticketType = ticketTypeById.get(item.ticketTypeId)!;
      return total + Number(ticketType.price) * item.quantity;
    }, 0);
    const primaryTicketType = ticketTypeById.get(items[0]!.ticketTypeId)!;
    const quantity = items.reduce((total, item) => total + item.quantity, 0);
    const reference = `VR-${nanoid(14).toUpperCase()}`;
    const order = await prisma.order.create({
      data: {
        userId,
        eventId: data.eventId,
        ticketTypeId: primaryTicketType.id,
        quantity,
        amount: new Prisma.Decimal(amount),
        currency: primaryTicketType.currency,
        reference,
        payment: {
          create: {
            eventId: data.eventId,
            provider: "PAYSTACK",
            reference,
            amount: new Prisma.Decimal(amount),
            currency: primaryTicketType.currency
          }
        },
        items: {
          create: items.map((item) => {
            const ticketType = ticketTypeById.get(item.ticketTypeId)!;
            return {
              ticketTypeId: ticketType.id,
              quantity: item.quantity,
              unitPrice: ticketType.price,
              currency: ticketType.currency
            };
          })
        }
      },
      include: { payment: true }
    });

    if (data.client === "mobile_webview") {
      return {
        reference,
        amount,
        currency: primaryTicketType.currency,
        email: userEmail
      };
    }

    const paystack = await paystackInitialize({ email: userEmail, amount, reference });
    await prisma.payment.update({
      where: { orderId: order.id },
      data: { authorizationUrl: paystack.authorization_url, providerReference: paystack.reference }
    });

    return { authorizationUrl: paystack.authorization_url, reference, amount, currency: primaryTicketType.currency, email: userEmail };
  },

  async verify(reference: string) {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` }
    });
    const payload = await response.json();
    if (!response.ok || !payload.status) throw new AppError(502, "PAYSTACK_ERROR", "Payment verification service is unavailable. Please try again.");
    if (payload.data.status !== "success") throw new AppError(402, "PAYMENT_NOT_SUCCESSFUL", "Payment is not successful yet.");

    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { reference },
        include: { event: true, user: { include: { profile: true } }, items: { include: { ticketType: true } }, ticketType: true, payment: true, tickets: { include: { ticketType: true } } }
      });
      if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
      if (order.status === "PAID") return { order, tickets: order.tickets, shouldEmail: false };
      const verifiedAmount = Number(payload.data.amount ?? 0) / 100;
      const verifiedCurrency = String(payload.data.currency ?? "").toUpperCase();
      if (verifiedAmount < Number(order.amount) || verifiedCurrency !== order.currency) {
        throw new AppError(409, "PAYMENT_AMOUNT_MISMATCH", "Verified payment does not match the order amount.");
      }

      const items = order.items.length ? order.items : [{ ticketType: order.ticketType, ticketTypeId: order.ticketTypeId, quantity: order.quantity }];
      const tickets: Prisma.TicketGetPayload<{ include: { ticketType: true } }>[] = [];

      for (const item of items) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { soldQuantity: { increment: item.quantity } }
        });

        for (let index = 0; index < item.quantity; index += 1) {
          const code = `TKT-${nanoid(12).toUpperCase()}`;
          const ticket = await tx.ticket.create({
            data: {
              userId: order.userId,
              eventId: order.eventId,
              ticketTypeId: item.ticketTypeId,
              orderId: order.id,
              code,
              qrCodePayload: `velvet-rope:${order.eventId}:${code}:${nanoid(24)}`,
              nfcCredential: {
                create: {
                  eventId: order.eventId,
                  userId: order.userId,
                  token: `nfc_${nanoid(32)}`
                }
              }
            },
            include: { ticketType: true }
          });
          tickets.push(ticket);
        }
      }

      await tx.payment.update({
        where: { orderId: order.id },
        data: { status: "SUCCESS", rawResponse: payload.data, verifiedAt: new Date() }
      });

      const paidOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: "PAID" },
        include: { event: true, user: { include: { profile: true } }, tickets: { include: { ticketType: true } } }
      });

      await tx.event.update({
        where: { id: order.eventId },
        data: { popularityScore: { increment: order.quantity * 5 } }
      });

      return { order: paidOrder, tickets, shouldEmail: true };
    });

    if (result.shouldEmail && result.tickets.length) {
      try {
        await emailService.sendTicketConfirmation({
          email: result.order.user.email,
          fullName: result.order.user.profile?.fullName ?? result.order.user.email,
          eventTitle: result.order.event.title,
          tickets: result.tickets.map((ticket) => ({
            code: ticket.code,
            ticketType: ticket.ticketType.name,
            qrCodePayload: ticket.qrCodePayload
          }))
        });
      } catch (error) {
        console.error("Ticket email failed after successful payment verification", error);
      }
    }

    return {
      id: result.order.id,
      status: result.order.status,
      reference: result.order.reference,
      amount: result.order.amount,
      currency: result.order.currency,
      eventTitle: result.order.event.title,
      tickets: result.tickets.map((ticket) => ({
        id: ticket.id,
        eventTitle: result.order.event.title,
        attendeeName: result.order.user.profile?.fullName ?? result.order.user.email,
        ticketType: ticket.ticketType.kind,
        qrCodePayload: ticket.qrCodePayload,
        status: ticket.status,
        startsAt: result.order.event.startsAt.toISOString()
      }))
    };
  }
};
