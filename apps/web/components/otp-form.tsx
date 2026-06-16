"use client";

import { useMutation } from "@tanstack/react-query";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const inputCls =
  "h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold";

/** Email OTP verification form shown after registration. */
export function OtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code,  setCode]  = useState("");

  const mutation = useMutation({
    mutationFn: () => api.verifyEmail({ email, code }),
    onSuccess: async (result) => {
      localStorage.setItem("velvet_access_token",  result.data.accessToken);
      localStorage.setItem("velvet_refresh_token", result.data.refreshToken);
      localStorage.setItem("velvet_user",          JSON.stringify(result.data.user));
      window.dispatchEvent(new Event("velvet-auth"));

      const pendingEmail    = sessionStorage.getItem("velvet_pending_email");
      const pendingPassword = sessionStorage.getItem("velvet_pending_password");
      if (pendingEmail === email && pendingPassword) {
        await signIn("credentials", { email, password: pendingPassword, redirect: false });
        sessionStorage.removeItem("velvet_pending_email");
        sessionStorage.removeItem("velvet_pending_password");
      }

      const redirectTo = (result.data as typeof result.data & { redirectTo?: string }).redirectTo;
      router.push(redirectTo ?? "/dashboard");
    }
  });

  return (
    <form
      className="w-full rounded-xl border border-vr-border bg-vr-card p-6 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h1 className="text-2xl font-bold text-vr-text">Verify your email</h1>
      <p className="mt-2 text-sm text-vr-muted">
        Enter the 6-digit code sent to your email. It expires in 10 minutes.
      </p>

      <label className="mt-6 block text-sm font-medium text-vr-text">Email</label>
      <input
        className={`${inputCls} mt-1.5`}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label className="mt-4 block text-sm font-medium text-vr-text">One-time code</label>
      <input
        className="mt-1.5 h-14 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-center text-2xl font-bold tracking-[0.4em] text-vr-gold outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        placeholder="······"
        required
      />

      {mutation.isError && (
        <div className="mt-4 rounded-lg border border-vr-danger/30 bg-vr-danger/10 px-3 py-2.5 text-sm text-vr-danger">
          {mutation.error.message}
        </div>
      )}

      <Button className="mt-6 w-full" size="lg" disabled={mutation.isPending || code.length !== 6}>
        {mutation.isPending ? "Verifying…" : "Verify account"}
      </Button>
    </form>
  );
}
