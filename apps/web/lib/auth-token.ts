import { decodeJwt } from "jose";
import { api } from "@/lib/api";

export type WebAuthUser = {
  id?: string;
  email: string;
  role: string;
  fullName?: string;
};

export function readWebAuthUser(): WebAuthUser | null {
  const storedUser = localStorage.getItem("velvet_user");
  if (storedUser) return JSON.parse(storedUser) as WebAuthUser;

  const accessToken = localStorage.getItem("velvet_access_token");
  if (!accessToken) return null;

  const payload = decodeJwt(accessToken);
  if (typeof payload.email !== "string" || typeof payload.role !== "string") return null;
  return {
    id: typeof payload.id === "string" ? payload.id : undefined,
    email: payload.email,
    role: payload.role
  };
}

function isHttps() {
  return typeof window !== "undefined" && window.location.protocol === "https:";
}

function setSessionCookie() {
  const secure = isHttps() ? "; Secure" : "";
  document.cookie = `velvet_auth=1; path=/; SameSite=Lax; max-age=2592000${secure}`;
}

function clearSessionCookie() {
  const secure = isHttps() ? "; Secure" : "";
  document.cookie = `velvet_auth=; path=/; SameSite=Lax; max-age=0${secure}`;
}

export function storeWebAuth(tokens: { accessToken: string; refreshToken: string; user: unknown }) {
  localStorage.setItem("velvet_access_token", tokens.accessToken);
  localStorage.setItem("velvet_refresh_token", tokens.refreshToken);
  localStorage.setItem("velvet_user", JSON.stringify(tokens.user));
  setSessionCookie();
  window.dispatchEvent(new Event("velvet-auth"));
}

export function clearWebAuth() {
  const token = localStorage.getItem("velvet_access_token");
  if (token) api.logout(token).catch(() => undefined);
  localStorage.removeItem("velvet_access_token");
  localStorage.removeItem("velvet_refresh_token");
  localStorage.removeItem("velvet_user");
  clearSessionCookie();
  window.dispatchEvent(new Event("velvet-auth"));
}

export async function getWebAccessToken() {
  const accessToken = localStorage.getItem("velvet_access_token");
  if (accessToken) {
    try {
      const payload = decodeJwt(accessToken);
      if (typeof payload.exp === "number" && payload.exp * 1000 > Date.now() + 30_000) return accessToken;
    } catch {
      // Refresh below.
    }
  }

  const refreshToken = localStorage.getItem("velvet_refresh_token");
  if (!refreshToken) {
    clearWebAuth();
    throw new Error("Your session has expired. Please log in again.");
  }

  try {
    const result = await api.refresh(refreshToken);
    storeWebAuth({ accessToken: result.data.accessToken, refreshToken: result.data.refreshToken, user: result.data.user });
    return result.data.accessToken;
  } catch {
    clearWebAuth();
    throw new Error("Your session has expired. Please log in again.");
  }
}
