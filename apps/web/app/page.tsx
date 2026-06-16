import Link from "next/link";
import { ArrowRight, CalendarPlus, ChartNoAxesCombined, QrCode, ShieldCheck, Ticket } from "lucide-react";
import { MetricStrip, PublicNav } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { HeroLiveSection } from "@/components/hero-live-section";
import { EventListClient } from "@/components/event-list-client";

const featureCards = [
  {
    icon: Ticket,
    title: "Smart Ticketing",
    body: "Regular, VIP, VVIP, and table sales. Invitations, order history, and QR delivery in one seamless flow."
  },
  {
    icon: QrCode,
    title: "Instant Entry",
    body: "Unique QR payloads and NFC wristbands. Duplicate-scan protection and per-gate analytics."
  },
  {
    icon: ShieldCheck,
    title: "Secure by Design",
    body: "RBAC, account lockout, payment verification before ticket issuance, and protected APIs throughout."
  },
  {
    icon: ChartNoAxesCombined,
    title: "Live Analytics",
    body: "Revenue, check-ins, vendor spend, social reach, table occupancy — all in real time."
  }
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-vr-black">
      <PublicNav />

      <main>
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-vr-border">
          {/* Background glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(107,79,160,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(249,115,22,0.08) 0%, transparent 60%)"
            }}
          />

          <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24 lg:px-8">

            {/* Left — copy */}
            <div className="flex flex-col">
              <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-vr-gold/30 bg-vr-gold/10 px-3 py-1 text-xs font-semibold text-vr-gold">
                VIP Event Management Platform
              </span>

              <h1 className="text-4xl font-bold leading-tight tracking-tight text-vr-text sm:text-5xl lg:text-6xl">
                Skip the Line.{" "}
                <span className="text-gold-gradient">Own the Night.</span>
              </h1>

              <p className="mt-6 max-w-lg text-lg leading-relaxed text-vr-muted">
                The premium platform for organizers to sell tickets, manage invitations, assign tables, scan QR entries, and understand every guest journey — from first invite to final check-out.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/events">
                  <Button size="lg">
                    Discover events
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href="/register?plan=organizer">
                  <Button variant="gold-outline" size="lg">
                    <CalendarPlus className="size-4" />
                    Start for free
                  </Button>
                </Link>
              </div>

              <div className="mt-10">
                <MetricStrip />
              </div>
            </div>

            {/* Right — live dashboard preview (carousel + featured event share one index) */}
            <div className="rounded-2xl border border-vr-border bg-vr-card p-1 shadow-gold">
              <HeroLiveSection />
            </div>
          </div>
        </section>

        {/* ── Feature cards ─────────────────────────────────────────────── */}
        <section className="border-b border-vr-border bg-vr-surface">
          <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {featureCards.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-vr-border bg-vr-card p-6 transition-all duration-200 hover:border-vr-gold/40 hover:shadow-gold"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-vr-gold/10 border border-vr-gold/20">
                  <Icon className="size-5 text-vr-gold" />
                </div>
                <h3 className="font-semibold text-vr-text">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-vr-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Featured events ───────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 lg:px-8">
          <EventListClient compact />
        </section>
      </main>
    </div>
  );
}
