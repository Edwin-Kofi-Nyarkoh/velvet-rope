import type { roles, ticketKinds } from "./constants";

export type Role = (typeof roles)[number];
export type TicketKind = (typeof ticketKinds)[number];

export type ApiResult<T> = {
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: Role;
    fullName: string;
  };
};

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  bannerUrl: string;
  category: string;
  venueName: string;
  city: string;
  startsAt: string;
  endsAt?: string;
  minPrice: number;
  currency: string;
  isPrivate: boolean;
  isLive?: boolean;
  isOngoing?: boolean;
  isPopular?: boolean;
  popularityScore?: number;
  ticketsSold?: number;
};

export type TicketSummary = {
  id: string;
  eventTitle: string;
  attendeeName: string;
  ticketType: TicketKind;
  qrCodePayload: string;
  qrCodeDataUrl?: string;
  nfcToken?: string | null;
  seat?: {
    label: string;
    table?: string | null;
    zone?: string | null;
  } | null;
  status: "ACTIVE" | "USED" | "EXPIRED" | "CANCELLED";
  startsAt: string;
};

export type DashboardMetric = {
  label: string;
  value: string | number;
};

export type VendorTransactionSummary = {
  id: string;
  reference: string;
  eventTitle: string;
  vendor: string;
  attendee?: string;
  description: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";
  createdAt: string;
  paidAt?: string | null;
};

export type EventMessageSummary = {
  id: string;
  eventTitle: string;
  sender: string;
  audience: "STAFF" | "VENDORS" | "ALL";
  subject: string;
  body?: string;
  createdAt: string;
};

export type SeatNavigationSummary = {
  id: string;
  label: string;
  status: "AVAILABLE" | "RESERVED" | "ASSIGNED" | "BLOCKED";
  eventTitle: string;
  venueName?: string;
  table: string;
  zone: string;
  route?: string[];
  ticketType?: string | null;
};

export type VipVerificationSummary = {
  accounts: Array<{
    id: string;
    provider: string;
    handle: string;
    displayName: string;
    followerCount: number;
    vipStatus: string;
    verifiedAt?: string | null;
  }>;
  requests: Array<{
    id: string;
    provider: string;
    handle: string;
    status: string;
    evidenceUrl?: string | null;
    reviewerNote?: string | null;
    submittedAt: string;
    reviewedAt?: string | null;
  }>;
};
