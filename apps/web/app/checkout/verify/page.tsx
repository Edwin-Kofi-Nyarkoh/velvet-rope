import { Suspense } from "react";
import { PaymentVerifyClient } from "@/components/payment-verify-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckoutVerifyPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <PaymentVerifyClient />
    </Suspense>
  );
}

function VerifyFallback() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-vr-border bg-vr-card p-6 shadow-soft">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="mt-5 h-8 w-64" />
        <Skeleton className="mt-4 h-5 w-full" />
      </div>
    </main>
  );
}
