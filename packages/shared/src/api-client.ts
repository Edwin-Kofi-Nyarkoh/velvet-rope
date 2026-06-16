import type { ApiResult, AuthSession, EventMessageSummary, EventSummary, SeatNavigationSummary, TicketSummary, VendorTransactionSummary, VipVerificationSummary } from "./types";

type RequestOptions = RequestInit & {
  token?: string;
};

export class VelvetApiClient {
  constructor(private readonly baseUrl: string) {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, { ...options, headers, signal: controller.signal });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      throw new Error(
        timedOut
          ? `Request timed out connecting to ${this.baseUrl}. Make sure the API server is running.`
          : `Network request failed for ${this.baseUrl}. Make sure the API is running and your phone is on the same Wi-Fi as your computer.`
      );
    } finally {
      clearTimeout(timeout);
    }
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error?.message ?? "Request failed";
      const code = payload?.error?.code as string | undefined;
      const redirectTo = (payload?.error?.details as { redirectTo?: string } | undefined)?.redirectTo;
      throw Object.assign(new Error(message), { code, redirectTo });
    }

    return payload as T;
  }

  register(input: { fullName: string; email: string; password: string; role?: string }) {
    return this.request<ApiResult<AuthSession>>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  verifyEmail(input: { email: string; code: string }) {
    return this.request<ApiResult<AuthSession>>("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  login(input: { email: string; password: string; otp?: string }) {
    return this.request<ApiResult<AuthSession>>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  me(token: string) {
    return this.request<ApiResult<AuthSession["user"] & { profile?: { fullName?: string; phone?: string; avatarUrl?: string; city?: string; country?: string } | null }>>("/users/me", {
      token
    });
  }

  refresh(refreshToken: string) {
    return this.request<ApiResult<AuthSession>>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  }

  events(params = "") {
    return this.request<ApiResult<EventSummary[]>>(`/events${params}`);
  }

  eventCategories() {
    return this.request<ApiResult<Array<{ id: string; name: string; slug: string }>>>("/event-categories");
  }

  staff(token: string) {
    return this.request<ApiResult<Array<Record<string, unknown>>>>("/staff", { token });
  }

  vendors(token: string) {
    return this.request<ApiResult<Array<Record<string, unknown>>>>("/vendors", { token });
  }

  myInvitations(token: string) {
    return this.request<ApiResult<Array<Record<string, unknown>>>>("/invitations/me", { token });
  }

  createEvent(token: string, input: Record<string, unknown>) {
    return this.request<ApiResult<Record<string, unknown>>>("/events", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  cloudinarySignature(token: string, folder?: string) {
    return this.request<ApiResult<{ cloudName: string; apiKey: string; folder: string; timestamp: number; signature: string }>>("/uploads/cloudinary-signature", {
      method: "POST",
      token,
      body: JSON.stringify({ folder })
    });
  }

  event(slug: string) {
    return this.request<ApiResult<EventSummary & {
      ticketTypes?: Array<{ id: string; name: string; kind: string; price: string | number; currency: string; quantity: number; soldQuantity: number }>;
      organizer?: { profile?: { fullName?: string } | null } | null;
      startsAt: string;
      endsAt?: string;
    }>>(`/events/${slug}`);
  }

  myTickets(token: string) {
    return this.request<ApiResult<TicketSummary[]>>("/tickets/me", { token });
  }

  attendeeDashboard(token: string) {
    return this.request<ApiResult<Record<string, unknown>>>("/dashboard/attendee", { token });
  }

  organizerDashboard(token: string) {
    return this.request<ApiResult<Record<string, unknown>>>("/dashboard/organizer", { token });
  }

  updateMe(token: string, input: { fullName?: string; phone?: string; city?: string; country?: string }) {
    return this.request<ApiResult<AuthSession["user"] & { profile?: Record<string, unknown> | null }>>("/users/me", {
      method: "PATCH",
      token,
      body: JSON.stringify(input)
    });
  }

  createInvitation(token: string, input: { eventId: string; email: string; recipientName: string; message?: string }) {
    return this.request<ApiResult<Record<string, unknown>>>("/invitations", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  initializePayment(
    token: string,
    input:
      | { eventId: string; ticketTypeId: string; quantity: number; client?: "server" | "mobile_webview" }
      | { eventId: string; items: Array<{ ticketTypeId: string; quantity: number }>; client?: "server" | "mobile_webview" }
  ) {
    return this.request<ApiResult<{ authorizationUrl?: string; reference: string; amount: number; currency: string; email: string }>>("/payments/initialize", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  verifyPayment(token: string, reference: string) {
    return this.request<ApiResult<{ id: string; status: string; tickets?: TicketSummary[] }>>("/payments/verify", {
      method: "POST",
      token,
      body: JSON.stringify({ reference })
    });
  }

  validateCheckIn(token: string, input: { qrCodePayload: string; gate?: string }) {
    return this.request<ApiResult<Record<string, unknown>>>("/checkins/validate", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  validateNfcCheckIn(token: string, input: { nfcToken: string; gate?: string }) {
    return this.request<ApiResult<Record<string, unknown>>>("/checkins/nfc/validate", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  calendarEvent(eventId: string) {
    return this.request<ApiResult<{ filename: string; ics: string }>>(`/calendar/events/${eventId}`);
  }

  friendsAttending(token: string, eventId: string) {
    return this.request<ApiResult<Array<Record<string, unknown>>>>(`/social/friends-attending?eventId=${encodeURIComponent(eventId)}`, { token });
  }

  hashtagAnalytics(token: string, eventId?: string) {
    const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
    return this.request<ApiResult<Record<string, unknown>>>(`/social/hashtag-analytics${query}`, { token });
  }

  upsertSocialAccount(token: string, input: { provider: "FACEBOOK" | "LINKEDIN" | "X" | "INSTAGRAM" | "TIKTOK"; handle: string; displayName: string; followerCount?: number }) {
    return this.request<ApiResult<Record<string, unknown>>>("/social/accounts", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  vipVerification(token: string) {
    return this.request<ApiResult<VipVerificationSummary>>("/vip/verification", { token });
  }

  submitVipVerification(token: string, input: { provider: "FACEBOOK" | "LINKEDIN" | "X" | "INSTAGRAM" | "TIKTOK"; handle: string; evidenceUrl?: string }) {
    return this.request<ApiResult<Record<string, unknown>>>("/vip/verification", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  mySeating(token: string) {
    return this.request<ApiResult<SeatNavigationSummary[]>>("/seating/me", { token });
  }

  organizerSeating(token: string, eventId?: string) {
    const path = eventId ? `/seating/events/${eventId}` : "/seating/events";
    return this.request<ApiResult<Array<Record<string, unknown>>>>(path, { token });
  }

  assignSeat(token: string, input: { seatId: string; ticketId: string }) {
    return this.request<ApiResult<Record<string, unknown>>>("/seating/assign", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  vendorTransactions(token: string) {
    return this.request<ApiResult<VendorTransactionSummary[]>>("/vendor-transactions", { token });
  }

  createVendorTransaction(token: string, input: { eventId: string; vendorId: string; description: string; amount: number; currency?: string }) {
    return this.request<ApiResult<Record<string, unknown>>>("/vendor-transactions", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  confirmVendorTransaction(token: string, id: string) {
    return this.request<ApiResult<Record<string, unknown>>>(`/vendor-transactions/${id}/confirm`, {
      method: "POST",
      token
    });
  }

  communications(token: string) {
    return this.request<ApiResult<EventMessageSummary[]>>("/communications", { token });
  }

  createCommunication(token: string, input: { eventId: string; audience: "STAFF" | "VENDORS" | "ALL"; subject: string; body: string }) {
    return this.request<ApiResult<Record<string, unknown>>>("/communications", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  createTicketType(token: string, input: { eventId: string; name: string; kind: string; price: number; currency: string; quantity: number }) {
    return this.request<ApiResult<Record<string, unknown>>>("/tickets/types", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    });
  }

  organizerAttendees(token: string) {
    return this.request<ApiResult<Array<Record<string, unknown>>>>("/organizer/attendees", { token });
  }

  ticketTypes(token: string, eventId?: string) {
    const query = eventId ? `?eventId=${encodeURIComponent(eventId)}` : "";
    return this.request<ApiResult<Array<Record<string, unknown>>>>(`/tickets/types${query}`, { token });
  }

  forgotPassword(email: string) {
    return this.request<ApiResult<{ message: string }>>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }

  resetPassword(token: string, password: string) {
    return this.request<ApiResult<{ message: string }>>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password })
    });
  }
}
