"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { getWebAccessToken } from "@/lib/auth-token";
import { Button } from "@/components/ui/button";

const inputCls =
  "h-10 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold";

/** Inline form to send an event invitation by email from the event detail page. */
export function InviteEventForm({ eventId }: { eventId: string }) {
  const [recipientName, setRecipientName] = useState("");
  const [email,         setEmail]         = useState("");
  const [message,       setMessage]       = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const token = await getWebAccessToken();
      return api.createInvitation(token, { eventId, recipientName, email, message: message || undefined });
    },
    onSuccess: () => {
      setRecipientName("");
      setEmail("");
      setMessage("");
    }
  });

  return (
    <form
      className="mt-6 rounded-xl border border-vr-border bg-vr-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h3 className="font-semibold text-vr-text">Invite someone</h3>
      <p className="mt-1 text-sm text-vr-muted">Send a private invitation to this event.</p>

      <div className="mt-4 grid gap-3">
        <input
          className={inputCls}
          placeholder="Recipient name"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          required
        />
        <input
          className={inputCls}
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <textarea
          className="min-h-20 w-full rounded-lg border border-vr-border bg-vr-surface px-3 py-2.5 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold resize-none"
          placeholder="Optional personal note…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {mutation.isError && (
        <div className="mt-3 rounded-lg border border-vr-danger/30 bg-vr-danger/10 px-3 py-2 text-sm text-vr-danger">
          {mutation.error.message}
        </div>
      )}
      {mutation.isSuccess && (
        <div className="mt-3 rounded-lg border border-vr-success/30 bg-vr-success/10 px-3 py-2 text-sm text-vr-success">
          Invitation sent successfully.
        </div>
      )}

      <Button className="mt-4 w-full" disabled={mutation.isPending}>
        {mutation.isPending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}
