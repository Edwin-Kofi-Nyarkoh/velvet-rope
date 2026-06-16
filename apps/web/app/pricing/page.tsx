import { PricingPlans } from "@/components/pricing-plans";
import { PublicNav } from "@/components/shell";

export default function PricingPage() {
  return (
    <div>
      <PublicNav />
      <main className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold text-vr-text">Plans for every event door</h1>
          <p className="mt-3 text-[17px] leading-7 text-vr-muted">
            Attendees stay free. Organizers choose the operational depth they need for ticketing, invitations, entry, staff, vendors, seating, and analytics.
          </p>
        </div>
        <PricingPlans />
      </main>
    </div>
  );
}
