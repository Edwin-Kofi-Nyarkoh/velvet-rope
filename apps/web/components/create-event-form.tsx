"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

const inputCls =
  "mt-1.5 h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold";

const labelCls = "block text-sm font-medium text-vr-text";

async function uploadToCloudinary(file: File, token: string) {
  const signature = await api.cloudinarySignature(token);
  const form      = new FormData();
  form.append("file",      file);
  form.append("api_key",   signature.data.apiKey);
  form.append("timestamp", String(signature.data.timestamp));
  form.append("signature", signature.data.signature);
  form.append("folder",    signature.data.folder);

  const res     = await fetch(`https://api.cloudinary.com/v1_1/${signature.data.cloudName}/image/upload`, { method: "POST", body: form });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error?.message ?? "Image upload failed.");
  return payload.secure_url as string;
}

/** Multi-field event creation form for organizers. */
export function CreateEventForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    title:       "",
    description: "",
    categoryId:  "",
    venueName:   "",
    address:     "",
    city:        "",
    country:     "Ghana",
    bannerUrl:   "",
    startsAt:    "",
    endsAt:      "",
    isPrivate:   false
  });
  const [file, setFile] = useState<File | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["event-categories"],
    queryFn:  () => api.eventCategories()
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("velvet_access_token");
      if (!token) throw new Error("Please log in again.");
      const bannerUrl = file ? await uploadToCloudinary(file, token) : form.bannerUrl;
      if (!bannerUrl) throw new Error("Please upload a banner image.");
      return api.createEvent(token, {
        ...form,
        bannerUrl,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt:   new Date(form.endsAt).toISOString()
      });
    },
    onSuccess: () => router.push("/organizer/events")
  });

  const update = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      className="rounded-xl border border-vr-border bg-vr-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelCls}>
          Event title
          <input className={inputCls} value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="My Amazing Event" required />
        </label>

        <label className={labelCls}>
          Category
          <select className={inputCls} value={form.categoryId} onChange={(e) => update("categoryId", e.target.value)} required>
            <option value="">Select category</option>
            {categoriesQuery.data?.data.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          Venue name
          <input className={inputCls} value={form.venueName} onChange={(e) => update("venueName", e.target.value)} placeholder="Club XYZ" required />
        </label>

        <label className={labelCls}>
          City
          <input className={inputCls} value={form.city} onChange={(e) => update("city", e.target.value)} placeholder="Accra" required />
        </label>

        <label className={labelCls}>
          Address
          <input className={inputCls} value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="123 Main St" required />
        </label>

        <label className={labelCls}>
          Country
          <input className={inputCls} value={form.country} onChange={(e) => update("country", e.target.value)} placeholder="Ghana" required />
        </label>

        <label className={labelCls}>
          Starts at
          <input className={inputCls} type="datetime-local" value={form.startsAt} onChange={(e) => update("startsAt", e.target.value)} required />
        </label>

        <label className={labelCls}>
          Ends at
          <input className={inputCls} type="datetime-local" value={form.endsAt} onChange={(e) => update("endsAt", e.target.value)} required />
        </label>
      </div>

      <label className={`mt-4 ${labelCls}`}>
        Banner image
        <input
          className="mt-1.5 h-11 w-full rounded-lg border border-vr-border bg-vr-surface px-3 py-2 text-sm text-vr-muted file:mr-3 file:rounded-md file:border-0 file:bg-vr-gold/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-vr-gold outline-none"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <label className={`mt-4 ${labelCls}`}>
        Description
        <textarea
          className="mt-1.5 min-h-32 w-full rounded-lg border border-vr-border bg-vr-surface p-3 text-sm text-vr-text placeholder:text-vr-muted outline-none transition-colors focus:border-vr-gold focus:ring-1 focus:ring-vr-gold resize-y"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Tell people what to expect…"
          required
        />
      </label>

      <label className="mt-4 flex items-center gap-2 text-sm font-medium text-vr-text cursor-pointer">
        <input
          type="checkbox"
          className="size-4 rounded border-vr-border accent-vr-gold"
          checked={form.isPrivate}
          onChange={(e) => update("isPrivate", e.target.checked)}
        />
        Private event (invite-only)
      </label>

      {mutation.isError && (
        <div className="mt-4 rounded-lg border border-vr-danger/30 bg-vr-danger/10 px-3 py-2.5 text-sm text-vr-danger">
          {mutation.error.message}
        </div>
      )}

      <Button className="mt-5" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save event"}
      </Button>
    </form>
  );
}
