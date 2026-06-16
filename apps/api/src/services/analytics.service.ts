import { prisma } from "../lib/prisma";

export const analyticsService = {
  async organizerOverview(organizerId: string) {
    const events = await prisma.event.findMany({
      where: { organizerId },
      include: { orders: true, tickets: true, checkIns: true }
    });
    const revenue = events.reduce(
      (sum, event) => sum + event.orders.filter((order) => order.status === "PAID").reduce((total, order) => total + Number(order.amount), 0),
      0
    );
    const ticketsSold = events.reduce((sum, event) => sum + event.tickets.length, 0);
    const checkIns = events.reduce((sum, event) => sum + event.checkIns.length, 0);
    return {
      eventCount: events.length,
      revenue,
      ticketsSold,
      checkIns,
      conversionRate: ticketsSold ? Math.round((checkIns / ticketsSold) * 100) : 0
    };
  }
};
