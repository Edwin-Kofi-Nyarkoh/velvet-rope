"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PublicNav } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [pending, setPending]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");

  useEffect(() => {
    if (!token) setError("Reset link is missing or invalid. Please request a new one.");
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 10)  { setError("Password must be at least 10 characters."); return; }
    setError("");
    setPending(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-vr-black">
      <PublicNav />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-12">
        {done ? (
          <div className="w-full rounded-xl border border-vr-border bg-vr-card p-8 text-center shadow-soft">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-vr-success/30 bg-vr-success/10">
              <span className="text-2xl">✓</span>
            </div>
            <h1 className="text-xl font-bold text-vr-text">Password updated</h1>
            <p className="mt-3 text-sm text-vr-muted">
              Your password has been changed. Redirecting you to login…
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full rounded-xl border border-vr-border bg-vr-card p-6 shadow-soft">
            <h1 className="text-2xl font-bold text-vr-text">Choose a new password</h1>
            <p className="mt-2 text-sm text-vr-muted">Must be at least 10 characters.</p>

            <div className="mt-5 grid gap-4">
              <input
                className="h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold"
                type="password"
                required
                minLength={10}
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <input
                className="h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold"
                type="password"
                required
                minLength={10}
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {error && <p className="mt-3 text-sm text-vr-danger">{error}</p>}

            <Button
              type="submit"
              className="mt-5 w-full"
              size="lg"
              disabled={pending || !password || !token}
            >
              {pending ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
