import cron from "node-cron";
import { prisma } from "../lib/prisma";

const retryDelay = (attempt: number) => new Promise((resolve) => setTimeout(resolve, attempt * 2500));

function isTransientDatabaseError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const maybeCode = "code" in error ? String((error as { code?: unknown }).code) : "";
  return maybeCode === "P1001" || /can't reach database|connection.*closed|forcibly closed|pooled\.db\.prisma\.io/i.test(error.message);
}

function cronMessage(name: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? ` ${(error as { code?: string }).code}` : "";
  const message = error instanceof Error ? error.message.split("\n")[0] : "Unknown error";
  console.warn(`[cron] ${name} skipped${code}: ${message}`);
}

async function runWithRetry(name: string, task: () => Promise<void>, retries = 2) {
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      await task();
      return;
    } catch (error) {
      if (attempt <= retries && isTransientDatabaseError(error)) {
        await retryDelay(attempt);
        continue;
      }
      cronMessage(name, error);
      return;
    }
  }
}

function exclusiveRunner(name: string, task: () => Promise<void>) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await runWithRetry(name, task);
    } finally {
      running = false;
    }
  };
}

async function cleanupExpiredVerifications() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  await prisma.user.deleteMany({
    where: {
      emailVerifiedAt: null,
      createdAt: { lt: oneHourAgo }
    }
  });
}

async function cleanupExpiredPasswordResets() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.passwordReset.deleteMany({
    where: {
      OR: [
        { usedAt: { lt: sevenDaysAgo } },
        { expiresAt: { lt: sevenDaysAgo } }
      ]
    }
  });
}

async function refreshEventState() {
  const now = new Date();
  await prisma.ticket.updateMany({
    where: {
      status: "ACTIVE",
      event: { endsAt: { lt: now } }
    },
    data: { status: "EXPIRED" }
  });

  await prisma.event.updateMany({
    where: {
      status: "PUBLISHED",
      endsAt: { lt: now }
    },
    data: { status: "COMPLETED" }
  });

  const publishedEvents = await prisma.event.findMany({
    where: { status: "PUBLISHED" },
    include: { ticketTypes: true }
  });

  await Promise.all(
    publishedEvents.map((event) => {
      const sold = event.ticketTypes.reduce((sum, ticketType) => sum + ticketType.soldQuantity, 0);
      const liveBoost = event.startsAt <= now && event.endsAt >= now ? 50 : 0;
      const upcomingBoost = event.startsAt > now ? Math.max(0, 20 - Math.ceil((event.startsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;
      const organizerBoost = event.isPopular ? 100 : 0;
      return prisma.event.update({
        where: { id: event.id },
        data: {
          popularityScore: organizerBoost + liveBoost + upcomingBoost + sold * 5 + event.viewCount
        }
      });
    })
  );
}

export function startCronJobs() {
  const runCleanup             = exclusiveRunner("verification cleanup",     cleanupExpiredVerifications);
  const runEventRefresh        = exclusiveRunner("event state refresh",      refreshEventState);
  const runPasswordResetCleanup = exclusiveRunner("password reset cleanup",  cleanupExpiredPasswordResets);

  setTimeout(() => void runCleanup(),              15_000);
  setTimeout(() => void runEventRefresh(),          30_000);
  setTimeout(() => void runPasswordResetCleanup(),  60_000);

  cron.schedule("* * * * *",    () => void runCleanup());
  cron.schedule("*/5 * * * *",  () => void runEventRefresh());
  cron.schedule("0 * * * *",    () => void runPasswordResetCleanup());
}
