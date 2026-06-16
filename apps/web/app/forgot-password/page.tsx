"use client";

import { useState } from "react";
import { PublicNav } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [pending, setPending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await api.forgotPassword(email.trim());
      setSent(true);
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
        {sent ? (
          <div className="w-full rounded-xl border border-vr-border bg-vr-card p-8 text-center shadow-soft">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-vr-gold/30 bg-vr-gold/10">
              <span className="text-2xl">✉</span>
            </div>
            <h1 className="text-xl font-bold text-vr-text">Check your inbox</h1>
            <p className="mt-3 text-sm text-vr-muted">
              If an account exists for <span className="text-vr-text">{email}</span>, a password reset link has been sent. It expires in 30 minutes.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full rounded-xl border border-vr-border bg-vr-card p-6 shadow-soft">
            <h1 className="text-2xl font-bold text-vr-text">Reset password</h1>
            <p className="mt-2 text-sm text-vr-muted">
              Enter your email and we&apos;ll send a secure reset link.
            </p>
            <input
              className="mt-5 h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <p className="mt-3 text-sm text-vr-danger">{error}</p>}
            <Button type="submit" className="mt-4 w-full" size="lg" disabled={pending || !email}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
