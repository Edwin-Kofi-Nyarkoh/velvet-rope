"use client";

import { useMutation } from "@tanstack/react-query";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

type AuthMode = "login" | "register";

const inputCls =
  "h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold";

const labelCls = "mt-5 block text-sm font-medium text-vr-text";

/** Login / registration form, styled with VR dark-luxury tokens. */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const router       = useRouter();
  const params       = useSearchParams();
  const [fullName,   setFullName]  = useState("");
  const [email,      setEmail]     = useState("");
  const [password,   setPassword]  = useState("");
  const [role,       setRole]      = useState("ATTENDEE");
  const selectedPlan = params.get("plan");

  useEffect(() => {
    if (params.get("role") === "ORGANIZER") setRole("ORGANIZER");
  }, [params]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "login") {
        const result = await signIn("credentials", { email, password, redirect: false });
        if (!result?.ok) throw new Error(result?.error ?? "Invalid email or password.");
        const session = await getSession();
        const user = session?.user as NonNullable<typeof session>["user"] & {
          accessToken?: string;
          refreshToken?: string;
          role?: string;
          redirectTo?: string;
        };
        if (!user?.accessToken || !user.refreshToken || !user.role) {
          throw new Error("Unable to start your secure session.");
        }
        return {
          data: {
            accessToken:  user.accessToken,
            refreshToken: user.refreshToken,
            user: {
              id:       user.email ?? email,
              email:    user.email ?? email,
              role:     user.role,
              fullName: user.name ?? "Guest"
            },
            redirectTo: user.redirectTo
          }
        };
      }
      return api.register({ fullName, email, password, role });
    },
    onError: (error) => {
      const err = error as Error & { redirectTo?: string };
      if (err.redirectTo) router.push(err.redirectTo);
    },
    onSuccess: (result) => {
      if (mode === "register") {
        sessionStorage.setItem("velvet_pending_email",    email);
        sessionStorage.setItem("velvet_pending_password", password);
        router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
        return;
      }
      localStorage.setItem("velvet_access_token",  result.data.accessToken);
      localStorage.setItem("velvet_refresh_token", result.data.refreshToken);
      localStorage.setItem("velvet_user",          JSON.stringify(result.data.user));
      window.dispatchEvent(new Event("velvet-auth"));
      const redirectTo = (result.data as typeof result.data & { redirectTo?: string }).redirectTo;
      router.push(redirectTo ?? (result.data.user.role === "ORGANIZER" ? "/organizer" : "/dashboard"));
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
      <h1 className="text-2xl font-bold text-vr-text">
        {mode === "login" ? "Welcome back" : "Create account"}
      </h1>
      <p className="mt-1.5 text-sm text-vr-muted">
        {mode === "login"
          ? "Sign in to your Velvet Rope account."
          : "Join the VIP event platform."}
      </p>

      {mode === "register" && selectedPlan && (
        <div className="mt-4 rounded-lg border border-vr-gold/30 bg-vr-gold/10 px-3 py-2.5 text-sm text-vr-gold">
          Selected organizer plan: <strong>{selectedPlan}</strong>
        </div>
      )}

      {mode === "register" && (
        <>
          <label className={labelCls}>Full name</label>
          <input
            className={inputCls}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            required
          />
        </>
      )}

      <label className={mode === "login" ? "mt-6 block text-sm font-medium text-vr-text" : labelCls}>
        Email
      </label>
      <input
        className={inputCls}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
      />

      {mode === "register" && (
        <>
          <label className={labelCls}>Account type</label>
          <select
            className={inputCls}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="ATTENDEE">Attendee</option>
            <option value="ORGANIZER">Organizer</option>
            <option value="STAFF">Staff</option>
            <option value="VENDOR">Vendor</option>
          </select>
        </>
      )}

      <label className={labelCls}>Password</label>
      <input
        className={inputCls}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        required
      />

      {mutation.isError && (
        <div className="mt-4 rounded-lg border border-vr-danger/30 bg-vr-danger/10 px-3 py-2.5 text-sm text-vr-danger">
          {mutation.error.message}
        </div>
      )}

      <Button className="mt-6 w-full" size="lg" disabled={mutation.isPending}>
        {mutation.isPending
          ? "Please wait…"
          : mode === "login"
          ? "Log in"
          : "Create account"}
      </Button>
    </form>
  );
}
