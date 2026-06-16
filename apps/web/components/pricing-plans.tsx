"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const plans = [
  {
    id:       "basic",
    name:     "Basic",
    price:    "3%",
    body:     "Public/private event pages, ticket sales, invitations, and QR entry.",
    features: ["Single events", "Ticket types", "Invitation tracking", "QR check-ins"],
    featured: false
  },
  {
    id:       "professional",
    name:     "Professional",
    price:    "2.5%",
    body:     "Professional operations for teams, vendors, tables, and deeper analytics.",
    features: ["Multi-day events", "Staff permissions", "Vendor management", "Seat/table assignments"],
    featured: true
  },
  {
    id:       "festival",
    name:     "Festival",
    price:    "Custom",
    body:     "High-volume admissions for venues, festivals, conferences, and agencies.",
    features: ["Series events", "Advanced analytics", "Dedicated controls", "Priority support"],
    featured: false
  }
];

export function PricingPlans() {
  const router = useRouter();

  return (
    <div className="mt-8 grid gap-5 md:grid-cols-3">
      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`relative rounded-xl border p-6 transition-all ${
            plan.featured
              ? "border-vr-gold bg-vr-card shadow-gold"
              : "border-vr-border bg-vr-card hover:border-vr-gold/40"
          }`}
        >
          {plan.featured && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-vr-gold/30 bg-vr-gold px-3 py-0.5 text-xs font-bold text-vr-black">
              Most popular
            </span>
          )}

          <h2 className="text-xl font-bold text-vr-text">{plan.name}</h2>
          <div className={`mt-4 text-3xl font-bold ${plan.featured ? "text-vr-gold" : "text-vr-text"}`}>
            {plan.price}
          </div>
          <p className="mt-3 min-h-14 text-sm leading-6 text-vr-muted">{plan.body}</p>

          <ul className="mt-5 space-y-3 text-sm">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-vr-text">
                <Check className="size-4 shrink-0 text-vr-gold" />
                {feature}
              </li>
            ))}
          </ul>

          <Button
            className="mt-6 w-full"
            variant={plan.featured ? "primary" : "gold-outline"}
            onClick={() => {
              localStorage.setItem("velvet_selected_plan", plan.id);
              router.push(`/register?plan=${plan.id}&role=ORGANIZER`);
            }}
          >
            Choose {plan.name}
          </Button>
        </div>
      ))}
    </div>
  );
}
