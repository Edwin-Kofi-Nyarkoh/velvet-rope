"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getWebAccessToken } from "@/lib/auth-token";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const inputCls =
  "h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold";

/** Profile settings form — updates name and contact details stored on the API. */
export function SettingsClient() {
  const [fullName, setFullName] = useState("");
  const [phone,    setPhone]    = useState("");
  const [city,     setCity]     = useState("");
  const [country,  setCountry]  = useState("");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn:  async () => api.me(await getWebAccessToken()),
    retry: false
  });

  useEffect(() => {
    const profile = meQuery.data?.data.profile;
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setPhone(profile.phone    ?? "");
    setCity(profile.city     ?? "");
    setCountry(profile.country  ?? "");
  }, [meQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async () =>
      api.updateMe(await getWebAccessToken(), { fullName, phone, city, country }),
    onSuccess: (result) => {
      localStorage.setItem("velvet_user", JSON.stringify(result.data));
      window.dispatchEvent(new Event("velvet-auth"));
    }
  });

  if (meQuery.isLoading) {
    return (
      <div className="max-w-2xl rounded-xl border border-vr-border bg-vr-card p-6">
        <Skeleton className="h-6 w-44" />
        <div className="mt-5 grid gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <form
      className="max-w-2xl rounded-xl border border-vr-border bg-vr-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        updateMutation.mutate();
      }}
    >
      <h2 className="text-lg font-semibold text-vr-text">Profile settings</h2>
      <p className="mt-1.5 text-sm text-vr-muted">
        Update the name and details used on tickets, invitations, and organizer records.
      </p>

      <div className="mt-5 grid gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-vr-text">Full name</label>
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-vr-text">Phone</label>
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233 …" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-vr-text">City</label>
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Accra" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-vr-text">Country</label>
            <input className={inputCls} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Ghana" />
          </div>
        </div>
      </div>

      {updateMutation.isError && (
        <div className="mt-4 rounded-lg border border-vr-danger/30 bg-vr-danger/10 px-3 py-2.5 text-sm text-vr-danger">
          {updateMutation.error.message}
        </div>
      )}
      {updateMutation.isSuccess && (
        <div className="mt-4 rounded-lg border border-vr-success/30 bg-vr-success/10 px-3 py-2.5 text-sm text-vr-success">
          Settings saved successfully.
        </div>
      )}

      <Button className="mt-5" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
