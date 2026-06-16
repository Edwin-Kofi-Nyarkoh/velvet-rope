"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getWebAccessToken } from "@/lib/auth-token";

/** Handles the Paystack callback and verifies the payment reference. */
export function PaymentVerifyClient() {
  const searchParams = useSearchParams();
  const reference    = searchParams.get("reference") ?? searchParams.get("trxref") ?? "";

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getWebAccessToken();
      if (!reference) throw new Error("Payment reference is missing.");
      return api.verifyPayment(token, reference);
    }
  });

  useEffect(() => {
    if (reference && mutation.isIdle) mutation.mutate();
  }, [mutation.isIdle, mutation.mutate, reference]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-vr-border bg-vr-card p-8 shadow-soft">
        {mutation.isPending || mutation.isIdle ? (
          <>
            <Skeleton className="size-14 rounded-full" />
            <Skeleton className="mt-5 h-8 w-64" />
            <Skeleton className="mt-3 h-5 w-full" />
            <Skeleton className="mt-6 h-11 w-36" />
          </>
        ) : mutation.isError ? (
          <>
            <div className="flex size-14 items-center justify-center rounded-full border border-vr-danger/30 bg-vr-danger/10">
              <XCircle className="size-7 text-vr-danger" />
            </div>
            <h1 className="mt-5 text-2xl font-bold text-vr-text">Payment needs attention</h1>
            <p className="mt-3 text-vr-muted">{mutation.error.message}</p>
            <Link href="/events">
              <Button variant="secondary" className="mt-6">Back to events</Button>
            </Link>
          </>
        ) : (
          <>
            <div className="flex size-14 items-center justify-center rounded-full border border-vr-success/30 bg-vr-success/10">
              <CheckCircle2 className="size-7 text-vr-success" />
            </div>
            <h1 className="mt-5 text-2xl font-bold text-vr-text">Payment confirmed</h1>
            <p className="mt-3 text-vr-muted">
              Your QR ticket has been created, emailed to you, and saved in your Velvet Rope account.
            </p>
            <Link href="/dashboard/tickets">
              <Button className="mt-6">View my tickets</Button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
