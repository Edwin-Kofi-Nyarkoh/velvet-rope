import { useEffect, useMemo, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Calendar, Check, Edit2, Home, LogIn, MessageSquare, Moon, Plus, QrCode, Search, Settings, ShieldCheck, ShoppingBag, Star, Sun, Ticket, Trash2, Users, WalletCards, Wifi, X as XIcon } from "lucide-react-native";
import { usePaystack } from "react-native-paystack-webview";
import type { EventSummary } from "@velvet-rope/shared";
import { Button, Card, Screen, Skeleton, Stat } from "./components";
import { api, paystackPublicKey } from "./api";
import type { AppTheme, ThemeMode } from "./theme";

type Notify = (message: string, title?: string, kind?: "success" | "error" | "info") => void;

const filters = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "upcoming", label: "Soon" },
  { value: "tomorrow", label: "Tmr" },
  { value: "popular", label: "Hot" }
];

async function clearMobileAuth() {
  const token = await SecureStore.getItemAsync("velvet_access_token").catch(() => null);
  if (token) api.logout(token).catch(() => undefined);
  await Promise.all([
    SecureStore.deleteItemAsync("velvet_access_token"),
    SecureStore.deleteItemAsync("velvet_refresh_token"),
    SecureStore.deleteItemAsync("velvet_user")
  ]);
}

async function storeMobileAuth(tokens: { accessToken: string; refreshToken: string; user: unknown }) {
  await Promise.all([
    SecureStore.setItemAsync("velvet_access_token", tokens.accessToken),
    SecureStore.setItemAsync("velvet_refresh_token", tokens.refreshToken),
    SecureStore.setItemAsync("velvet_user", JSON.stringify(tokens.user))
  ]);
}

function authError(message: string): Error {
  return Object.assign(new Error(message), { status: 401 });
}

async function refreshMobileAccessToken() {
  const refreshToken = await SecureStore.getItemAsync("velvet_refresh_token");
  if (!refreshToken) {
    await clearMobileAuth();
    throw authError("Your session has expired. Please log in again.");
  }
  try {
    const result = await api.refresh(refreshToken);
    await storeMobileAuth({ accessToken: result.data.accessToken, refreshToken: result.data.refreshToken, user: result.data.user });
    return result.data.accessToken;
  } catch {
    await clearMobileAuth();
    throw authError("Your session has expired. Please log in again.");
  }
}

async function withMobileAuth<T>(request: (token: string) => Promise<T>) {
  const token = await SecureStore.getItemAsync("velvet_access_token");
  if (!token) throw authError("Please log in to continue.");
  try {
    return await request(token);
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status !== 401) throw error;
    return request(await refreshMobileAccessToken());
  }
}

function isAuthError(error: unknown): boolean {
  return (error as Error & { status?: number })?.status === 401;
}

export function AuthScreen({ go, onRole, theme, notify }: { go: (screen: string) => void; onRole: (role: string | null) => void; theme: AppTheme; notify: Notify }) {
  const [mode, setMode] = useState<"login" | "register" | "verify" | "forgot" | "reset">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPw, setResetPw] = useState("");
  const [resetConfirmPw, setResetConfirmPw] = useState("");

  const loginMutation = useMutation({
    mutationFn: () => api.login({ email, password }),
    onSuccess: async (result) => {
      await storeMobileAuth({ accessToken: result.data.accessToken, refreshToken: result.data.refreshToken, user: result.data.user });
      notify("You are signed in and ready to manage tickets.", "Welcome back", "success");
      onRole(result.data.user.role);
      go(["ORGANIZER", "ADMIN", "SUPER_ADMIN"].includes(result.data.user.role) ? "organizer" : "home");
    },
    onError: (error) => notify(error.message, "Login failed", "error")
  });

  const registerMutation = useMutation({
    mutationFn: () => api.register({ fullName, email, password, role: "ATTENDEE" }),
    onSuccess: () => {
      notify("Enter the code we sent to your email. It expires in 30 minutes.", "Verify your email", "success");
      setMode("verify");
    },
    onError: (error) => notify(error.message, "Account could not be created", "error")
  });

  const verifyMutation = useMutation({
    mutationFn: () => api.verifyEmail({ email, code }),
    onSuccess: async (result) => {
      await storeMobileAuth({ accessToken: result.data.accessToken, refreshToken: result.data.refreshToken, user: result.data.user });
      notify("Your account has been verified.", "Account ready", "success");
      onRole(result.data.user.role);
      go("home");
    },
    onError: (error) => notify(error.message, "Verification failed", "error")
  });

  const forgotMutation = useMutation({
    mutationFn: () => api.forgotPassword(email),
    onSuccess: () => {
      notify("Check your email for a reset link. Then come back and tap 'I have a reset token'.", "Reset link sent", "success");
    },
    onError: (error) => notify(error.message, "Reset failed", "error")
  });

  const resetMutation = useMutation({
    mutationFn: () => {
      if (resetPw !== resetConfirmPw) throw new Error("Passwords do not match.");
      if (resetPw.length < 8) throw new Error("Password must be at least 8 characters.");
      return api.resetPassword(resetToken, resetPw);
    },
    onSuccess: () => {
      notify("Password updated. Please log in with your new password.", "Password reset", "success");
      setMode("login");
      setResetToken(""); setResetPw(""); setResetConfirmPw("");
    },
    onError: (error) => notify(error.message, "Reset failed", "error")
  });

  const activeMutation = mode === "login" ? loginMutation : mode === "register" ? registerMutation : mode === "verify" ? verifyMutation : mode === "forgot" ? forgotMutation : resetMutation;

  const modeTitle: Record<typeof mode, string> = { login: "Welcome back", register: "Create account", verify: "Verify email", forgot: "Reset password", reset: "New password" };
  const modeCopy: Record<typeof mode, string> = {
    login: "Use the same secure account across web, Android, and iOS.",
    register: "Use the same secure account across web, Android, and iOS.",
    verify: "Enter the 6-digit code sent to your email. It expires in 30 minutes.",
    forgot: "Enter your email and we'll send you a reset link.",
    reset: "Paste the token from your reset email, then set a new password."
  };
  const modeButton: Record<typeof mode, string> = { login: "Log in", register: "Create account", verify: "Verify account", forgot: "Send reset link", reset: "Set new password" };

  return (
    <Screen theme={theme}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: theme.colors.ink }]}>{modeTitle[mode]}</Text>
        <Text style={[styles.copy, { color: theme.colors.slate }]}>{modeCopy[mode]}</Text>
        {mode === "register" && <TextInput style={inputStyle(theme)} placeholder="Full name" placeholderTextColor={theme.colors.slate} value={fullName} onChangeText={setFullName} />}
        {(mode === "login" || mode === "register" || mode === "forgot") && (
          <TextInput style={inputStyle(theme)} placeholder="Email" placeholderTextColor={theme.colors.slate} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        )}
        {(mode === "login" || mode === "register") && (
          <TextInput style={inputStyle(theme)} placeholder="Password" placeholderTextColor={theme.colors.slate} secureTextEntry value={password} onChangeText={setPassword} />
        )}
        {mode === "verify" && <TextInput style={inputStyle(theme)} placeholder="Verification code" placeholderTextColor={theme.colors.slate} keyboardType="number-pad" value={code} onChangeText={setCode} />}
        {mode === "reset" && (
          <>
            <TextInput style={inputStyle(theme)} placeholder="Reset token (from email link)" placeholderTextColor={theme.colors.slate} autoCapitalize="none" value={resetToken} onChangeText={setResetToken} />
            <TextInput style={inputStyle(theme)} placeholder="New password" placeholderTextColor={theme.colors.slate} secureTextEntry value={resetPw} onChangeText={setResetPw} />
            <TextInput style={inputStyle(theme)} placeholder="Confirm new password" placeholderTextColor={theme.colors.slate} secureTextEntry value={resetConfirmPw} onChangeText={setResetConfirmPw} />
          </>
        )}
        {activeMutation.isError && <Text style={[styles.error, { color: theme.colors.danger }]}>{activeMutation.error.message}</Text>}
        <Button theme={theme} label={activeMutation.isPending ? "Please wait..." : modeButton[mode]} disabled={activeMutation.isPending} onPress={() => activeMutation.mutate()} />
        {(mode === "register" || mode === "forgot" || mode === "reset") && (
          <Pressable onPress={() => setMode("login")}>
            <Text style={[styles.link, { color: theme.colors.slate }]}>Back to login</Text>
          </Pressable>
        )}
        {mode === "login" && (
          <Pressable onPress={() => setMode("register")}>
            <Text style={[styles.link, { color: theme.colors.slate }]}>Create a new account</Text>
          </Pressable>
        )}
        {mode === "login" && (
          <Pressable onPress={() => setMode("forgot")}>
            <Text style={[styles.link, { color: theme.colors.slate }]}>Forgot password?</Text>
          </Pressable>
        )}
        {mode === "forgot" && (
          <Pressable onPress={() => setMode("reset")}>
            <Text style={[styles.link, { color: theme.colors.slate }]}>I have a reset token</Text>
          </Pressable>
        )}
        {(mode === "login" || mode === "register") && (
          <Pressable onPress={() => go("home")}>
            <Text style={[styles.link, { color: theme.colors.gold }]}>Continue as guest</Text>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

export function HomeFeedScreen({
  go,
  openEvent,
  theme,
  isAuthenticated,
  themeMode,
  setThemeMode
}: {
  go: (screen: string) => void;
  openEvent: (slug: string) => void;
  theme: AppTheme;
  isAuthenticated: boolean;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [liveIndex, setLiveIndex] = useState(0);
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (filter !== "all") params.set("filter", filter);
    const value = params.toString();
    return value ? `?${value}` : "";
  }, [filter, search]);
  const eventsQuery = useQuery({ queryKey: ["events", queryString], queryFn: () => api.events(queryString) });
  const apiEvents = eventsQuery.data?.data ?? [];
  const visibleEvents = useMemo(
    () => apiEvents.filter((event) => `${event.title} ${event.venueName} ${event.category} ${event.city}`.toLowerCase().includes(search.toLowerCase())),
    [apiEvents, search]
  );

  useEffect(() => {
    if (apiEvents.length <= 1) return;
    const timer = setInterval(() => setLiveIndex((current) => (current + 1) % apiEvents.length), 5000);
    return () => clearInterval(timer);
  }, [apiEvents.length]);

  const liveEvent = apiEvents.length ? apiEvents[liveIndex % apiEvents.length] : undefined;
  return (
    <Screen theme={theme}>
      <ScrollView
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.homeScrollContent}
        refreshControl={<RefreshControl refreshing={eventsQuery.isRefetching && !eventsQuery.isLoading} onRefresh={() => void eventsQuery.refetch()} tintColor={theme.colors.gold} colors={[theme.colors.gold]} progressBackgroundColor={theme.colors.card} />}
      >
        <View>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: theme.colors.slate }]}>Velvet Rope</Text>
              <Text style={[styles.heading, { color: theme.colors.ink }]}>Explore events</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={[styles.themeToggle, { backgroundColor: theme.colors.card, borderColor: theme.colors.line }]}
                onPress={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
              >
                {themeMode === "dark"
                  ? <Sun size={16} color={theme.colors.gold} />
                  : <Moon size={16} color={theme.colors.gold} />
                }
              </Pressable>
              {isAuthenticated && <BellButton go={go} theme={theme} />}
              {!isAuthenticated && (
                <Pressable style={[styles.loginButton, { backgroundColor: theme.colors.gold }]} onPress={() => go("auth")}>
                  <LogIn size={16} color="#ffffff" />
                  <Text style={styles.loginButtonText}>Log in</Text>
                </Pressable>
              )}
            </View>
          </View>
          {liveEvent && (
            <Pressable style={[styles.liveCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.line }]} onPress={() => openEvent(liveEvent.slug)}>
              <Text style={[styles.liveKicker, { color: theme.colors.gold }]}>Live now</Text>
              <Text style={[styles.headerLiveText, { color: theme.colors.ink }]} numberOfLines={1}>{liveEvent.title}</Text>
              <Text style={[styles.muted, { color: theme.colors.slate }]}>{liveEvent.venueName}, {liveEvent.city}</Text>
            </Pressable>
          )}
          <Card theme={theme} style={{ marginBottom: 14 }}>
            <Text style={[styles.liveKicker, { color: theme.colors.gold }]}>Secure platform for organized admissions</Text>
            <Text style={[styles.cardTitle, { color: theme.colors.ink, marginTop: 6 }]}>Ticketing, invitations, QR entry, vendors, seating, and analytics in one clean flow.</Text>
          </Card>
          <View style={[styles.search, { backgroundColor: theme.colors.card, borderColor: theme.colors.line }]}>
            <Search size={18} color={theme.colors.slate} />
            <TextInput placeholder="Search events, organizer tools..." placeholderTextColor={theme.colors.slate} style={[styles.searchInput, { color: theme.colors.ink }]} value={search} onChangeText={setSearch} />
          </View>
          {/organizer|organise|organize|manage|create/i.test(search) && (
            <View style={{ marginBottom: 14 }}>
              <Card theme={theme}>
                <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Organizer tools</Text>
                <Text style={[styles.copy, { color: theme.colors.slate }]}>Log in as an organizer to manage events, tickets, staff, vendors, seating, and analytics.</Text>
                <View style={{ height: 12 }} />
                <Button theme={theme} label="Log in" onPress={() => go("auth")} />
              </Card>
            </View>
          )}
        </View>
        <View style={[styles.stickyFilterSurface, { backgroundColor: theme.colors.surface }]}>
          <ScrollView horizontal style={styles.filterScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {filters.map((item) => (
              <Pressable key={item.value} onPress={() => setFilter(item.value)} style={[styles.filterPill, { backgroundColor: filter === item.value ? theme.colors.ink : theme.colors.card, borderColor: filter === item.value ? theme.colors.ink : theme.colors.line }]}>
                <View style={[styles.filterDot, { backgroundColor: filter === item.value ? theme.colors.gold : theme.colors.line }]} />
                <Text style={{ color: filter === item.value ? theme.colors.surface : theme.colors.slate, fontWeight: "800", fontSize: 13 }}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <View style={styles.eventListBlock}>
          {eventsQuery.isLoading ? (
            <EventListSkeleton theme={theme} />
          ) : eventsQuery.isError ? (
            <Card theme={theme}>
              <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Events could not load</Text>
              <Text style={[styles.copy, { color: theme.colors.slate }]}>{eventsQuery.error.message}</Text>
              <View style={{ height: 12 }} />
              <Button theme={theme} label="Try again" onPress={() => eventsQuery.refetch()} />
            </Card>
          ) : visibleEvents.length === 0 ? (
            <Card theme={theme}>
              <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>No events found</Text>
              <Text style={[styles.copy, { color: theme.colors.slate }]}>Try another filter or search term.</Text>
            </Card>
          ) : (
            visibleEvents.map((event) => <EventRow key={event.id} event={event} theme={theme} onPress={() => openEvent(event.slug)} />)
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function EventRow({ event, theme, onPress }: { event: EventSummary; theme: AppTheme; onPress: () => void }) {
  const date = new Date(event.startsAt);
  return (
    <Pressable onPress={onPress}>
      <Card theme={theme}>
        <Image source={{ uri: event.bannerUrl }} style={styles.eventImage} resizeMode="cover" />
        <View style={styles.eventBadges}>
          {event.isLive && <Text style={[styles.badge, { backgroundColor: theme.colors.gold, color: "#ffffff" }]}>Live</Text>}
          {event.isPopular && <Text style={[styles.badge, { backgroundColor: theme.colors.muted, color: theme.colors.ink }]}>Popular</Text>}
          <Text style={[styles.badge, { backgroundColor: theme.colors.muted, color: theme.colors.slate }]}>{event.category}</Text>
        </View>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.colors.ink }]} numberOfLines={2}>{event.title}</Text>
            <Text style={[styles.muted, { color: theme.colors.slate }]}>{event.venueName} - {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text>
          </View>
          <Text style={[styles.price, { color: theme.colors.gold }]}>{event.currency} {event.minPrice}</Text>
        </View>
        <View style={[styles.eventAction, { borderTopColor: theme.colors.line }]}>
          <Text style={{ color: theme.colors.gold, fontWeight: "800", fontSize: 14 }}>View details</Text>
        </View>
      </Card>
    </Pressable>
  );
}

export function EventDetailsScreen({ slug, go, theme, isAuthenticated, notify }: { slug: string | null; go: (screen: string) => void; theme: AppTheme; isAuthenticated: boolean; notify: Notify }) {
  const queryClient = useQueryClient();
  const { popup } = usePaystack();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const eventQuery = useQuery({ queryKey: ["event", slug], queryFn: () => api.event(slug ?? ""), enabled: Boolean(slug) });
  const event = eventQuery.data?.data;
  const ticketTypes = event?.ticketTypes ?? [];
  const selectedItems = ticketTypes.map((ticket) => ({ ticketTypeId: ticket.id, quantity: quantities[ticket.id] ?? 0, ticket })).filter((item) => item.quantity > 0);
  const totalAmount = selectedItems.reduce((sum, item) => sum + Number(item.ticket.price) * item.quantity, 0);
  const totalQuantity = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const currency = ticketTypes[0]?.currency ?? "GHS";

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!paystackPublicKey) throw new Error("Payment is not configured. Please contact support.");
      if (!event) throw new Error("Event is still loading.");
      if (!selectedItems.length) throw new Error("Select at least one ticket.");
      return withMobileAuth((token) => api.initializePayment(token, { eventId: event.id, client: "mobile_webview", items: selectedItems.map((item) => ({ ticketTypeId: item.ticketTypeId, quantity: item.quantity })) }));
    },
    onSuccess: (result) => {
      popup.checkout({
        email: result.data.email,
        amount: Number(result.data.amount),
        reference: result.data.reference,
        metadata: {
          custom_fields: [
            {
              display_name: "Velvet Rope Reference",
              variable_name: "velvet_rope_reference",
              value: result.data.reference
            }
          ]
        },
        onSuccess: async (paymentResult) => {
          const reference = paymentResult.reference || result.data.reference;
          setVerifyingPayment(true);
          try {
            await withMobileAuth((token) => api.verifyPayment(token, reference));
            await queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
            await queryClient.invalidateQueries({ queryKey: ["events"] });
            notify("Your QR ticket is ready in My tickets.", "Payment successful", "success");
            go("ticket");
          } catch (error) {
            notify(error instanceof Error ? error.message : "Payment verification failed.", "Verification failed", "error");
          } finally {
            setVerifyingPayment(false);
          }
        },
        onCancel: () => notify("Payment was cancelled. No ticket was issued.", "Checkout cancelled", "info"),
        onError: (error) => notify(error?.message ?? "Unable to open Paystack checkout.", "Checkout error", "error")
      });
    },
    onError: (error) => {
      if (isAuthError(error)) {
        notify("Please log in before buying tickets.", "Login required", "error");
        go("auth");
        return;
      }
      notify(error.message, "Checkout", "error");
    }
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error("Event is still loading.");
      return withMobileAuth((token) => api.createInvitation(token, { eventId: event.id, recipientName: inviteName, email: inviteEmail, message: inviteMessage || undefined }));
    },
    onSuccess: () => {
      setInviteName("");
      setInviteEmail("");
      setInviteMessage("");
      notify("Invitation sent to the email address.", "Invitation", "success");
    },
    onError: (error) => {
      if (isAuthError(error)) {
        notify("Please log in before sending invitations.", "Login required", "error");
        go("auth");
        return;
      }
      notify(error.message, "Invitation", "error");
    }
  });

  const calendarMutation = useMutation({
    mutationFn: async () => {
      if (!event) throw new Error("Event is still loading.");
      return api.calendarEvent(event.id);
    },
    onSuccess: (result) => notify(`${result.data.filename} is ready to add to your calendar.`, "Calendar file ready", "success"),
    onError: (error) => notify(error.message, "Calendar", "error")
  });

  const friendsQuery = useQuery({
    queryKey: ["friends-attending", event?.id],
    queryFn: async () => withMobileAuth((token) => api.friendsAttending(token, event!.id)),
    enabled: Boolean(event?.id && isAuthenticated),
    retry: false
  });

  if (eventQuery.isLoading) {
    return (
      <Screen theme={theme}>
        <SubPageHeader title="Event details" theme={theme} onBack={() => go("home")} />
        <EventDetailSkeleton theme={theme} />
      </Screen>
    );
  }

  if (eventQuery.isError) {
    return (
      <Screen theme={theme}>
        <SubPageHeader title="Event details" theme={theme} onBack={() => go("home")} />
        <Card theme={theme}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>This event could not load</Text>
          <Text style={[styles.copy, { color: theme.colors.slate }]}>{eventQuery.error.message}</Text>
          <View style={{ height: 12 }} />
          <Button theme={theme} label="Try again" onPress={() => eventQuery.refetch()} />
        </Card>
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen theme={theme}>
        <SubPageHeader title="Event details" theme={theme} onBack={() => go("home")} />
        <Text style={[styles.title, { color: theme.colors.ink }]}>Event not found</Text>
      </Screen>
    );
  }

  return (
    <Screen theme={theme}>
      <SubPageHeader title="Event details" theme={theme} onBack={() => go("home")} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={16}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={eventQuery.isRefetching && !eventQuery.isLoading} onRefresh={() => void eventQuery.refetch()} tintColor={theme.colors.gold} colors={[theme.colors.gold]} progressBackgroundColor={theme.colors.card} />}
      >
        <Image source={{ uri: event.bannerUrl }} style={styles.detailImage} resizeMode="cover" />
        <Text style={[styles.title, { color: theme.colors.ink }]}>{event.title}</Text>
        <Text style={[styles.copy, { color: theme.colors.slate }]}>{event.description}</Text>
        <Text style={[styles.muted, { color: theme.colors.slate }]}>{event.venueName}, {event.city}</Text>
        <Text style={[styles.muted, { color: theme.colors.slate }]}>
          {new Date(event.startsAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          {event.endsAt ? ` — ${new Date(event.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : ""}
        </Text>
        {(event as Record<string, unknown> & { organizer?: { profile?: { fullName?: string } | null } | null }).organizer?.profile?.fullName && (
          <Text style={[styles.muted, { color: theme.colors.slate }]}>By {(event as Record<string, unknown> & { organizer?: { profile?: { fullName?: string } | null } | null }).organizer!.profile!.fullName}</Text>
        )}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Tickets</Text>
          {ticketTypes.map((ticket) => {
            const available = ticket.quantity - ticket.soldQuantity;
            const quantity = quantities[ticket.id] ?? 0;
            return (
              <View key={ticket.id} style={[styles.ticketLine, { borderBottomColor: theme.colors.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.colors.ink, fontWeight: "700" }}>{ticket.name}</Text>
                  <Text style={[styles.muted, { color: theme.colors.slate }]}>{ticket.currency} {Number(ticket.price).toLocaleString()} - {available} left</Text>
                </View>
                <View style={styles.stepper}>
                  <Pressable style={[styles.stepperButton, { borderColor: theme.colors.line }]} onPress={() => setQuantities((current) => ({ ...current, [ticket.id]: Math.max(0, quantity - 1) }))}>
                    <Text style={{ color: theme.colors.ink }}>-</Text>
                  </Pressable>
                  <Text style={{ color: theme.colors.ink, width: 24, textAlign: "center", fontWeight: "800" }}>{quantity}</Text>
                  <Pressable style={[styles.stepperButton, { borderColor: theme.colors.line }]} onPress={() => setQuantities((current) => ({ ...current, [ticket.id]: Math.min(10, quantity + 1) }))}>
                    <Text style={{ color: theme.colors.ink }}>+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          <View style={[styles.ticketLine, { borderBottomWidth: 0 }]}>
            <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Total</Text>
            <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>{currency} {totalAmount.toLocaleString()}</Text>
          </View>
        </Card>
        <View style={{ height: 16 }} />
        <Button theme={theme} label={checkoutMutation.isPending || verifyingPayment ? "Processing checkout..." : "Continue to checkout"} disabled={!totalQuantity || checkoutMutation.isPending || verifyingPayment} onPress={() => checkoutMutation.mutate()} />
        <View style={{ height: 10 }} />
        <Button theme={theme} label={calendarMutation.isPending ? "Preparing calendar..." : "Add to Calendar"} secondary onPress={() => calendarMutation.mutate()} />
        {!isAuthenticated && (
          <>
            <View style={{ height: 10 }} />
            <Button theme={theme} label="Log in / create account" secondary onPress={() => go("auth")} />
          </>
        )}
        {isAuthenticated && (friendsQuery.data?.data?.length ?? 0) > 0 && (
          <Card theme={theme} style={{ marginTop: 18 }}>
            <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Friends attending</Text>
            {friendsQuery.data?.data.map((friend) => (
              <Text key={String(friend.id)} style={[styles.muted, { color: theme.colors.slate }]}>{String(friend.fullName)} - {String(friend.provider)} - {String(friend.status)}</Text>
            ))}
          </Card>
        )}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Invite someone</Text>
          <Text style={[styles.copy, { color: theme.colors.slate }]}>Send this event to a friend by email.</Text>
          <TextInput style={inputStyle(theme)} placeholder="Recipient name" placeholderTextColor={theme.colors.slate} value={inviteName} onChangeText={setInviteName} />
          <TextInput style={inputStyle(theme)} placeholder="Email address" placeholderTextColor={theme.colors.slate} autoCapitalize="none" keyboardType="email-address" value={inviteEmail} onChangeText={setInviteEmail} />
          <TextInput style={[inputStyle(theme), { minHeight: 76, paddingTop: 12 }]} placeholder="Optional note" placeholderTextColor={theme.colors.slate} multiline value={inviteMessage} onChangeText={setInviteMessage} />
          <View style={{ height: 12 }} />
          <Button theme={theme} label={inviteMutation.isPending ? "Sending..." : "Send invitation"} disabled={inviteMutation.isPending || !inviteName || !inviteEmail} onPress={() => inviteMutation.mutate()} />
        </Card>
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export function TicketScreen({ go, theme, notify }: { go: (screen: string) => void; theme: AppTheme; notify: Notify }) {
  const queryClient = useQueryClient();
  const ticketsQuery = useQuery({
    queryKey: ["my-tickets"],
    queryFn: async () => withMobileAuth((token) => api.myTickets(token)),
    retry: false
  });
  const refreshTickets = (showToast = false) => {
    if (showToast) notify("Checking for your latest tickets.", "Refreshing", "info");
    void ticketsQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
  };

  return (
    <Screen theme={theme}>
      <View style={styles.header}>
        <Text style={[styles.titleSmall, { color: theme.colors.ink }]}>My tickets</Text>
        <Pressable onPress={() => refreshTickets(true)}>
          <Text style={[styles.price, { color: theme.colors.gold }]}>Refresh</Text>
        </Pressable>
      </View>
      {ticketsQuery.isLoading ? (
        <ScrollView refreshControl={<RefreshControl refreshing={ticketsQuery.isRefetching && !ticketsQuery.isLoading} onRefresh={() => refreshTickets()} tintColor={theme.colors.gold} colors={[theme.colors.gold]} progressBackgroundColor={theme.colors.card} />}>
          <TicketSkeleton theme={theme} />
        </ScrollView>
      ) : ticketsQuery.isError ? (
        <ScrollView refreshControl={<RefreshControl refreshing={ticketsQuery.isRefetching && !ticketsQuery.isLoading} onRefresh={() => refreshTickets()} tintColor={theme.colors.gold} colors={[theme.colors.gold]} progressBackgroundColor={theme.colors.card} />}>
          <Card theme={theme}>
            <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Tickets could not load</Text>
            <Text style={[styles.copy, { color: theme.colors.slate }]}>{ticketsQuery.error.message}</Text>
            <View style={{ height: 12 }} />
            <Button theme={theme} label={isAuthError(ticketsQuery.error) ? "Log in" : "Try again"} onPress={() => (isAuthError(ticketsQuery.error) ? go("auth") : ticketsQuery.refetch())} />
          </Card>
        </ScrollView>
      ) : (
        <FlatList
          data={ticketsQuery.data?.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 14, paddingBottom: 156, flexGrow: 1 }}
          refreshing={ticketsQuery.isRefetching && !ticketsQuery.isLoading}
          onRefresh={() => refreshTickets()}
          ListEmptyComponent={
            <Card theme={theme}>
              <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>No tickets yet</Text>
              <Text style={[styles.copy, { color: theme.colors.slate }]}>When you buy tickets, your QR codes will appear here.</Text>
              <View style={{ height: 12 }} />
              <Button theme={theme} label="Browse events" onPress={() => go("home")} />
            </Card>
          }
          renderItem={({ item }) => (
            <Card theme={theme}>
              {item.qrCodeDataUrl ? <Image source={{ uri: item.qrCodeDataUrl }} style={styles.qrImage} /> : <QrCode size={120} color={theme.colors.gold} />}
              <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>{item.eventTitle}</Text>
              <Text style={[styles.muted, { color: theme.colors.slate }]}>{item.ticketType} - {item.status}</Text>
              {item.seat && <Text style={[styles.muted, { color: theme.colors.slate }]}>Seat {item.seat.table ?? ""} {item.seat.label} - {item.seat.zone ?? "Main"}</Text>}
              {item.nfcToken && <Text style={[styles.qrPayload, { color: theme.colors.slate, backgroundColor: theme.colors.muted }]}>NFC ••••{item.nfcToken.slice(-4)}</Text>}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

export function InvitationsScreen({ go, theme }: { go: (screen: string) => void; theme: AppTheme }) {
  const queryClient = useQueryClient();

  const invitationsQuery = useQuery({
    queryKey: ["my-invitations"],
    queryFn: async () => withMobileAuth((token) => api.myInvitations(token)),
    retry: false
  });

  const respondMutation = useMutation({
    mutationFn: ({ invToken, status }: { invToken: string; status: "ACCEPTED" | "DECLINED" }) =>
      api.respondToInvitation(invToken, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-invitations"] })
  });

  return (
    <Screen theme={theme}>
      <Text style={[styles.title, { color: theme.colors.ink }]}>Invitations</Text>
      {invitationsQuery.isLoading ? (
        <TicketSkeleton theme={theme} />
      ) : invitationsQuery.isError ? (
        <Card theme={theme}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Invitations could not load</Text>
          <Text style={[styles.copy, { color: theme.colors.slate }]}>{invitationsQuery.error.message}</Text>
          <View style={{ height: 12 }} />
          <Button theme={theme} label={isAuthError(invitationsQuery.error) ? "Log in" : "Try again"} onPress={() => (isAuthError(invitationsQuery.error) ? go("auth") : invitationsQuery.refetch())} />
        </Card>
      ) : (invitationsQuery.data?.data.length ?? 0) === 0 ? (
        <Card theme={theme}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>No invitations yet</Text>
          <Text style={[styles.copy, { color: theme.colors.slate }]}>Private invitations will appear here once an organizer sends one to your email.</Text>
        </Card>
      ) : (
        <FlatList
          data={invitationsQuery.data?.data ?? []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ gap: 14, paddingBottom: 156 }}
          refreshing={invitationsQuery.isRefetching && !invitationsQuery.isLoading}
          onRefresh={() => void invitationsQuery.refetch()}
          renderItem={({ item }) => (
            <Card theme={theme}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={[styles.cardTitle, { color: theme.colors.ink, flex: 1 }]}>{String(item.eventTitle)}</Text>
                <Text style={{ fontSize: 11, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, overflow: "hidden", color: "#000", backgroundColor: String(item.status) === "ACCEPTED" ? "#22c55e" : String(item.status) === "DECLINED" ? "#ef4444" : theme.colors.gold }}>{String(item.status)}</Text>
              </View>
              <Text style={[styles.muted, { color: theme.colors.slate }]}>From {String(item.sender)}</Text>
              {item.message ? <Text style={[styles.copy, { color: theme.colors.slate }]}>{String(item.message)}</Text> : null}
              {String(item.status) === "PENDING" && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  <Pressable
                    onPress={() => respondMutation.mutate({ invToken: String(item.token), status: "ACCEPTED" })}
                    disabled={respondMutation.isPending}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.colors.gold }}
                  >
                    <Check size={14} color="#000000" />
                    <Text style={{ fontWeight: "800", fontSize: 13, color: "#000000" }}>Accept</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => respondMutation.mutate({ invToken: String(item.token), status: "DECLINED" })}
                    disabled={respondMutation.isPending}
                    style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.line }}
                  >
                    <XIcon size={14} color={theme.colors.slate} />
                    <Text style={{ fontWeight: "800", fontSize: 13, color: theme.colors.slate }}>Decline</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

export function SettingsScreen({ go, onRole, theme, notify }: { go: (screen: string) => void; onRole: (role: string | null) => void; theme: AppTheme; notify: Notify }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [socialProvider, setSocialProvider] = useState<"X" | "FACEBOOK" | "LINKEDIN" | "INSTAGRAM" | "TIKTOK">("X");
  const [socialHandle, setSocialHandle] = useState("");
  const [socialName, setSocialName] = useState("");
  const [followers, setFollowers] = useState("0");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => withMobileAuth((token) => api.me(token)),
    retry: false
  });

  useEffect(() => {
    const profile = meQuery.data?.data.profile;
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setPhone(profile.phone ?? "");
    setCity(profile.city ?? "");
    setCountry(profile.country ?? "");
  }, [meQuery.data]);

  const updateMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => api.updateMe(token, { fullName, phone, city, country })),
    onSuccess: async (result) => {
      await SecureStore.setItemAsync("velvet_user", JSON.stringify(result.data));
      notify("Settings saved.", "Profile updated", "success");
    },
    onError: (error) => notify(error.message, "Settings", "error")
  });

  const vipQuery = useQuery({
    queryKey: ["vip-verification"],
    queryFn: async () => withMobileAuth((token) => api.vipVerification(token)),
    retry: false
  });

  const socialMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => api.upsertSocialAccount(token, { provider: socialProvider, handle: socialHandle, displayName: socialName || socialHandle, followerCount: Number(followers) || 0 })),
    onSuccess: () => {
      notify("Social account linked.", "VIP verification", "success");
      void vipQuery.refetch();
    },
    onError: (error) => notify(error.message, "VIP verification", "error")
  });

  const vipMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => api.submitVipVerification(token, { provider: socialProvider, handle: socialHandle, evidenceUrl: evidenceUrl || undefined })),
    onSuccess: () => {
      notify("VIP verification request submitted.", "VIP verification", "success");
      void vipQuery.refetch();
    },
    onError: (error) => notify(error.message, "VIP verification", "error")
  });

  const changePwMutation = useMutation({
    mutationFn: async () => {
      if (newPw !== confirmPw) throw new Error("New passwords do not match.");
      return withMobileAuth((token) => api.changePassword(token, { currentPassword: currentPw, newPassword: newPw }));
    },
    onSuccess: () => {
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      notify("Password updated successfully.", "Security", "success");
    },
    onError: (error) => notify(error.message, "Change password", "error")
  });

  const logout = async () => {
    await clearMobileAuth();
    onRole(null);
    go("home");
  };

  return (
    <Screen theme={theme}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 156 }}
        refreshControl={<RefreshControl refreshing={meQuery.isRefetching && !meQuery.isLoading} onRefresh={() => void meQuery.refetch()} tintColor={theme.colors.gold} colors={[theme.colors.gold]} progressBackgroundColor={theme.colors.card} />}
      >
        <Text style={[styles.title, { color: theme.colors.ink }]}>Settings</Text>
        <Text style={[styles.copy, { color: theme.colors.slate }]}>Update the name and preferences used on tickets and invitations.</Text>
        {meQuery.isLoading ? (
          <TicketSkeleton theme={theme} />
        ) : (
          <Card theme={theme} style={{ marginTop: 18 }}>
            <TextInput style={inputStyle(theme)} placeholder="Full name" placeholderTextColor={theme.colors.slate} value={fullName} onChangeText={setFullName} />
            <TextInput style={inputStyle(theme)} placeholder="Phone" placeholderTextColor={theme.colors.slate} value={phone} onChangeText={setPhone} />
            <TextInput style={inputStyle(theme)} placeholder="City" placeholderTextColor={theme.colors.slate} value={city} onChangeText={setCity} />
            <TextInput style={inputStyle(theme)} placeholder="Country" placeholderTextColor={theme.colors.slate} value={country} onChangeText={setCountry} />
            <View style={{ height: 14 }} />
            <Button theme={theme} label={updateMutation.isPending ? "Saving..." : "Save settings"} disabled={updateMutation.isPending} onPress={() => updateMutation.mutate()} />
            <View style={{ height: 10 }} />
            <Button theme={theme} label="Log out" secondary onPress={logout} />
          </Card>
        )}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>VIP and social verification</Text>
          <Text style={[styles.copy, { color: theme.colors.slate }]}>Link a social account for VIP influencer checks and friends-attending signals.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8 }}>
            {(["X", "FACEBOOK", "LINKEDIN", "INSTAGRAM", "TIKTOK"] as const).map((p) => (
              <Pressable key={p} onPress={() => setSocialProvider(p)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: socialProvider === p ? theme.colors.gold : theme.colors.line, backgroundColor: socialProvider === p ? theme.colors.gold + "20" : "transparent" }}>
                <Text style={{ color: socialProvider === p ? theme.colors.gold : theme.colors.slate, fontWeight: "800", fontSize: 12 }}>{p}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput style={inputStyle(theme)} placeholder={`${socialProvider} handle`} placeholderTextColor={theme.colors.slate} autoCapitalize="none" value={socialHandle} onChangeText={setSocialHandle} />
          <TextInput style={inputStyle(theme)} placeholder="Display name" placeholderTextColor={theme.colors.slate} value={socialName} onChangeText={setSocialName} />
          <TextInput style={inputStyle(theme)} placeholder="Follower count" placeholderTextColor={theme.colors.slate} keyboardType="number-pad" value={followers} onChangeText={setFollowers} />
          <TextInput style={inputStyle(theme)} placeholder="Evidence URL (optional, e.g. profile link)" placeholderTextColor={theme.colors.slate} autoCapitalize="none" keyboardType="url" value={evidenceUrl} onChangeText={setEvidenceUrl} />
          <View style={{ height: 12 }} />
          <Button theme={theme} label={socialMutation.isPending ? "Linking..." : `Link ${socialProvider} account`} disabled={!socialHandle || socialMutation.isPending} onPress={() => socialMutation.mutate()} />
          <View style={{ height: 10 }} />
          <Button theme={theme} label={vipMutation.isPending ? "Submitting..." : "Request VIP verification"} secondary disabled={!socialHandle || vipMutation.isPending} onPress={() => vipMutation.mutate()} />
          {vipQuery.data?.data.accounts.map((account) => (
            <Text key={account.id} style={[styles.muted, { color: theme.colors.slate }]}>{account.provider} @{account.handle} — {account.vipStatus}</Text>
          ))}
        </Card>

        <Card theme={theme} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Change password</Text>
          <TextInput style={inputStyle(theme)} placeholder="Current password" placeholderTextColor={theme.colors.slate} secureTextEntry value={currentPw} onChangeText={setCurrentPw} />
          <TextInput style={inputStyle(theme)} placeholder="New password" placeholderTextColor={theme.colors.slate} secureTextEntry value={newPw} onChangeText={setNewPw} />
          <TextInput style={inputStyle(theme)} placeholder="Confirm new password" placeholderTextColor={theme.colors.slate} secureTextEntry value={confirmPw} onChangeText={setConfirmPw} />
          <View style={{ height: 14 }} />
          <Button theme={theme} label={changePwMutation.isPending ? "Updating..." : "Update password"} disabled={!currentPw || !newPw || !confirmPw || changePwMutation.isPending} onPress={() => changePwMutation.mutate()} />
        </Card>

        <Pressable
          onPress={() => go("orders")}
          style={[styles.markAllBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.line, marginTop: 18, flexDirection: "row", gap: 10, justifyContent: "flex-start" }]}
        >
          <ShoppingBag size={18} color={theme.colors.gold} />
          <Text style={{ color: theme.colors.ink, fontWeight: "700", fontSize: 15 }}>My orders</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

export function ScannerScreen({ go, theme, notify }: { go: (screen: string) => void; theme: AppTheme; notify: Notify }) {
  const [mode, setMode] = useState<"QR" | "NFC">("QR");
  const [payload, setPayload] = useState("");
  const [gate, setGate] = useState("Main");
  const scanMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => mode === "QR" ? api.validateCheckIn(token, { qrCodePayload: payload, gate }) : api.validateNfcCheckIn(token, { nfcToken: payload, gate })),
    onSuccess: () => notify("Entry validated.", "Scanner", "success"),
    onError: (error) => notify(error.message, "Scanner", "error")
  });

  return (
    <Screen theme={theme}>
      <SubPageHeader title="Staff scanner" theme={theme} onBack={() => go("home")} />
      <Text style={[styles.title, { color: theme.colors.ink }]}>Staff scanner</Text>
      <Card theme={theme}>
        <View style={styles.row}>
          <Button theme={theme} label="QR" secondary={mode !== "QR"} onPress={() => setMode("QR")} />
          <Button theme={theme} label="NFC" secondary={mode !== "NFC"} onPress={() => setMode("NFC")} />
        </View>
        <TextInput style={[inputStyle(theme), { minHeight: 86, paddingTop: 12 }]} placeholder={mode === "QR" ? "Paste QR payload" : "Paste NFC token"} placeholderTextColor={theme.colors.slate} multiline value={payload} onChangeText={setPayload} />
        <TextInput style={inputStyle(theme)} placeholder="Gate" placeholderTextColor={theme.colors.slate} value={gate} onChangeText={setGate} />
        <View style={{ height: 12 }} />
        <Button theme={theme} label={scanMutation.isPending ? "Validating..." : "Validate entry"} disabled={!payload || scanMutation.isPending} onPress={() => scanMutation.mutate()} />
      </Card>
      <Card theme={theme} style={{ marginTop: 18 }}>
        <ShieldCheck size={28} color={theme.colors.gold} />
        <Text style={[styles.cardTitle, { color: theme.colors.ink, marginTop: 12 }]}>Scan result</Text>
        {scanMutation.data ? Object.entries(scanMutation.data.data).map(([key, value]) => (
          <Text key={key} style={[styles.muted, { color: theme.colors.slate }]}>{key}: {String(value)}</Text>
        )) : <Text style={[styles.copy, { color: theme.colors.slate }]}>Validate QR tickets or NFC wristbands directly against the backend.</Text>}
      </Card>
    </Screen>
  );
}

export function OrganizerQuickScreen({ go, theme }: { go?: (screen: string) => void; theme: AppTheme }) {
  const queryClient = useQueryClient();

  // Communication form
  const [commEventId, setCommEventId] = useState("");
  const [commAudience, setCommAudience] = useState<"STAFF" | "VENDORS" | "ALL">("ALL");
  const [commSubject, setCommSubject] = useState("");
  const [commBody, setCommBody] = useState("");

  // Event editing
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editCity, setEditCity] = useState("");

  // Staff form
  const [staffEmail, setStaffEmail] = useState("");
  const [staffEventId, setStaffEventId] = useState("");

  // Ticket type form
  const [ttEventId, setTtEventId] = useState("");
  const [ttName, setTtName] = useState("");
  const [ttKind, setTtKind] = useState<"REGULAR" | "VIP" | "VVIP" | "TABLE">("REGULAR");
  const [ttPrice, setTtPrice] = useState("");
  const [ttQty, setTtQty] = useState("");

  // Vendor form
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorBusiness, setVendorBusiness] = useState("");
  const [vendorCategory, setVendorCategory] = useState("");

  // Seating
  const [assignSeatId, setAssignSeatId] = useState("");
  const [assignTicketId, setAssignTicketId] = useState("");

  const dashboardQuery = useQuery({ queryKey: ["organizer-dashboard"], queryFn: async () => withMobileAuth((token) => api.organizerDashboard(token)), retry: false });
  const transactionsQuery = useQuery({ queryKey: ["vendor-transactions"], queryFn: async () => withMobileAuth((token) => api.vendorTransactions(token)), retry: false });
  const messagesQuery = useQuery({ queryKey: ["communications"], queryFn: async () => withMobileAuth((token) => api.communications(token)), retry: false });
  const socialQuery = useQuery({ queryKey: ["hashtag-analytics"], queryFn: async () => withMobileAuth((token) => api.hashtagAnalytics(token)), retry: false });
  const staffQuery = useQuery({ queryKey: ["staff"], queryFn: async () => withMobileAuth((token) => api.staff(token)), retry: false });
  const attendeesQuery = useQuery({ queryKey: ["organizer-attendees"], queryFn: async () => withMobileAuth((token) => api.organizerAttendees(token)), retry: false });
  const ticketTypesQuery = useQuery({ queryKey: ["ticket-types"], queryFn: async () => withMobileAuth((token) => api.ticketTypes(token)), retry: false });
  const seatingQuery = useQuery({ queryKey: ["organizer-seating"], queryFn: async () => withMobileAuth((token) => api.organizerSeating(token)), retry: false });
  const vendorsQuery = useQuery({ queryKey: ["vendors"], queryFn: async () => withMobileAuth((token) => api.vendors(token)), retry: false });

  const confirmTxMutation = useMutation({
    mutationFn: async (id: string) => withMobileAuth((token) => api.confirmVendorTransaction(token, id)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["vendor-transactions"] })
  });

  const sendCommMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => api.createCommunication(token, { eventId: commEventId, audience: commAudience, subject: commSubject, body: commBody })),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["communications"] }); setCommSubject(""); setCommBody(""); }
  });

  const updateEventMutation = useMutation({
    mutationFn: async (id: string) => withMobileAuth((token) => api.updateEvent(token, id, { title: editTitle, venueName: editVenue, city: editCity })),
    onSuccess: () => { setEditingEventId(null); void dashboardQuery.refetch(); }
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => withMobileAuth((token) => api.deleteEvent(token, id)),
    onSuccess: () => void dashboardQuery.refetch()
  });

  const popularityMutation = useMutation({
    mutationFn: async ({ id, isPopular }: { id: string; isPopular: boolean }) => withMobileAuth((token) => api.updateEventPopularity(token, id, { isPopular })),
    onSuccess: () => void dashboardQuery.refetch()
  });

  const addStaffMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => api.addStaff(token, { email: staffEmail, eventId: staffEventId, canScanTickets: true, canManageGuests: true })),
    onSuccess: () => { setStaffEmail(""); void staffQuery.refetch(); }
  });

  const removeStaffMutation = useMutation({
    mutationFn: async (id: string) => withMobileAuth((token) => api.removeStaff(token, id)),
    onSuccess: () => void staffQuery.refetch()
  });

  const createTicketTypeMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => api.createTicketType(token, { eventId: ttEventId, name: ttName, kind: ttKind, price: Number(ttPrice), currency: "GHS", quantity: Number(ttQty) })),
    onSuccess: () => { setTtName(""); setTtPrice(""); setTtQty(""); void ticketTypesQuery.refetch(); }
  });

  const addVendorMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => api.addVendor(token, { email: vendorEmail, businessName: vendorBusiness, category: vendorCategory })),
    onSuccess: () => { setVendorEmail(""); setVendorBusiness(""); setVendorCategory(""); void vendorsQuery.refetch(); }
  });

  const removeVendorMutation = useMutation({
    mutationFn: async (id: string) => withMobileAuth((token) => api.removeVendor(token, id)),
    onSuccess: () => void vendorsQuery.refetch()
  });

  const assignSeatMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => api.assignSeat(token, { seatId: assignSeatId, ticketId: assignTicketId })),
    onSuccess: () => { setAssignSeatId(""); setAssignTicketId(""); void seatingQuery.refetch(); }
  });

  const data = dashboardQuery.data?.data as Record<string, unknown> | undefined;
  const metrics = (data?.metrics ?? {}) as Record<string, unknown>;
  const events = (data?.events ?? []) as Record<string, unknown>[];
  const staffList = (staffQuery.data?.data ?? []) as Record<string, unknown>[];
  const attendeeList = (attendeesQuery.data?.data ?? []) as Record<string, unknown>[];
  const ticketTypeList = (ticketTypesQuery.data?.data ?? []) as Record<string, unknown>[];
  const vendorList = (vendorsQuery.data?.data ?? []) as Record<string, unknown>[];
  const seatingData = (seatingQuery.data?.data ?? []) as Record<string, unknown>[];
  const socialSummary = ((socialQuery.data?.data as Record<string, unknown> | undefined)?.summary ?? []) as Record<string, unknown>[];

  return (
    <Screen theme={theme}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 156 }}
        refreshControl={<RefreshControl refreshing={dashboardQuery.isRefetching} onRefresh={() => { void dashboardQuery.refetch(); void transactionsQuery.refetch(); void messagesQuery.refetch(); void socialQuery.refetch(); void staffQuery.refetch(); void attendeesQuery.refetch(); void ticketTypesQuery.refetch(); void vendorsQuery.refetch(); void seatingQuery.refetch(); }} tintColor={theme.colors.gold} colors={[theme.colors.gold]} progressBackgroundColor={theme.colors.card} />}
      >
        <Text style={[styles.title, { color: theme.colors.ink }]}>Organizer dashboard</Text>
        <Button theme={theme} label="Open QR / NFC scanner" secondary onPress={() => go?.("scanner")} />
        <View style={{ height: 14 }} />

        {/* Metrics */}
        {dashboardQuery.isLoading ? (
          <TicketSkeleton theme={theme} />
        ) : dashboardQuery.isError ? (
          <Card theme={theme}>
            <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Dashboard could not load</Text>
            <Text style={[styles.copy, { color: theme.colors.slate }]}>{dashboardQuery.error.message}</Text>
          </Card>
        ) : (
          <>
            <View style={styles.stats}>
              <Stat theme={theme} label="Revenue" value={`GHS ${Number(metrics.revenue ?? 0).toLocaleString()}`} />
              <Stat theme={theme} label="Tickets" value={String(metrics.ticketsSold ?? 0)} />
            </View>
            <View style={styles.stats}>
              <Stat theme={theme} label="Check-ins" value={String(metrics.checkIns ?? 0)} />
              <Stat theme={theme} label="Vendors" value={String(metrics.vendors ?? 0)} />
            </View>
          </>
        )}

        {/* Events management */}
        <Card theme={theme} style={{ marginTop: 4 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Events</Text>
          {events.map((event) => (
            <View key={String(event.id)} style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 12 }}>
              {editingEventId === String(event.id) ? (
                <>
                  <TextInput style={inputStyle(theme)} placeholder="Title" placeholderTextColor={theme.colors.slate} value={editTitle} onChangeText={setEditTitle} />
                  <TextInput style={inputStyle(theme)} placeholder="Venue name" placeholderTextColor={theme.colors.slate} value={editVenue} onChangeText={setEditVenue} />
                  <TextInput style={inputStyle(theme)} placeholder="City" placeholderTextColor={theme.colors.slate} value={editCity} onChangeText={setEditCity} />
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <View style={{ flex: 1 }}><Button theme={theme} label={updateEventMutation.isPending ? "Saving..." : "Save"} disabled={updateEventMutation.isPending} onPress={() => updateEventMutation.mutate(String(event.id))} /></View>
                    <View style={{ flex: 1 }}><Button theme={theme} label="Cancel" secondary onPress={() => setEditingEventId(null)} /></View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.muted, { color: theme.colors.ink, fontWeight: "700" }]}>{String(event.title)}</Text>
                  <Text style={[styles.muted, { color: theme.colors.slate }]}>{String(event.ticketsSold ?? 0)} sold · {String(event.checkIns ?? 0)} check-ins</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <Pressable onPress={() => { setEditingEventId(String(event.id)); setEditTitle(String(event.title)); setEditVenue(String(event.venueName ?? "")); setEditCity(String(event.city ?? "")); }} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.line }}>
                      <Edit2 size={14} color={theme.colors.gold} />
                    </Pressable>
                    <Pressable onPress={() => popularityMutation.mutate({ id: String(event.id), isPopular: !event.isPopular })} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.line }}>
                      <Star size={14} color={event.isPopular ? theme.colors.gold : theme.colors.slate} fill={event.isPopular ? theme.colors.gold : "none"} />
                    </Pressable>
                    <Pressable onPress={() => deleteEventMutation.mutate(String(event.id))} disabled={deleteEventMutation.isPending} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.line }}>
                      <Trash2 size={14} color={theme.colors.danger} />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ))}
        </Card>

        {/* Staff */}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <Users size={22} color={theme.colors.gold} />
          <Text style={[styles.cardTitle, { color: theme.colors.ink, marginTop: 10 }]}>Staff</Text>
          {staffList.map((member) => {
            const user = (member.user ?? {}) as Record<string, unknown>;
            const profile = (user.profile ?? {}) as Record<string, unknown>;
            return (
              <View key={String(member.id)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.muted, { color: theme.colors.ink, fontWeight: "700" }]}>{String(profile.fullName ?? user.email ?? "")}</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.slate }}>{String(user.email ?? "")} · {String((member.event as Record<string, unknown> | undefined)?.title ?? "")}</Text>
                </View>
                <Pressable onPress={() => removeStaffMutation.mutate(String(member.id))} disabled={removeStaffMutation.isPending} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.line }}>
                  <Trash2 size={14} color={theme.colors.danger} />
                </Pressable>
              </View>
            );
          })}
          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 12 }}>
            <Text style={[styles.muted, { color: theme.colors.slate, fontWeight: "700", marginBottom: 4 }]}>Add staff</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
              {events.map((ev) => (
                <Pressable key={String(ev.id)} onPress={() => setStaffEventId(String(ev.id))} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: staffEventId === String(ev.id) ? theme.colors.gold : theme.colors.line, backgroundColor: staffEventId === String(ev.id) ? theme.colors.gold + "20" : "transparent" }}>
                  <Text style={{ color: staffEventId === String(ev.id) ? theme.colors.gold : theme.colors.slate, fontSize: 12, fontWeight: "700" }}>{String(ev.title)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={inputStyle(theme)} placeholder="Staff email" placeholderTextColor={theme.colors.slate} autoCapitalize="none" keyboardType="email-address" value={staffEmail} onChangeText={setStaffEmail} />
            <View style={{ height: 10 }} />
            <Button theme={theme} label={addStaffMutation.isPending ? "Adding..." : "Add staff member"} disabled={!staffEmail || !staffEventId || addStaffMutation.isPending} onPress={() => addStaffMutation.mutate()} />
          </View>
        </Card>

        {/* Attendees */}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Attendees</Text>
          {attendeesQuery.isLoading ? (
            <Text style={[styles.muted, { color: theme.colors.slate }]}>Loading...</Text>
          ) : attendeeList.length === 0 ? (
            <Text style={[styles.muted, { color: theme.colors.slate }]}>No attendees yet.</Text>
          ) : attendeeList.slice(0, 10).map((attendee) => (
            <View key={String(attendee.id)} style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.line }}>
              <Text style={[styles.muted, { color: theme.colors.ink, fontWeight: "700" }]}>{String(attendee.attendeeName ?? attendee.email ?? "")}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.slate }}>{String(attendee.eventTitle ?? "")} · {String(attendee.ticketType ?? "")} · {String(attendee.status ?? "")}</Text>
            </View>
          ))}
          {attendeeList.length > 10 && <Text style={[styles.muted, { color: theme.colors.slate }]}>+{attendeeList.length - 10} more</Text>}
        </Card>

        {/* Ticket types */}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <Ticket size={22} color={theme.colors.gold} />
          <Text style={[styles.cardTitle, { color: theme.colors.ink, marginTop: 10 }]}>Ticket types</Text>
          {ticketTypeList.slice(0, 8).map((tt) => (
            <Text key={String(tt.id)} style={[styles.muted, { color: theme.colors.slate }]}>{String(tt.name)} · GHS {String(tt.price)} · {String(tt.soldQuantity ?? 0)}/{String(tt.quantity ?? 0)} sold</Text>
          ))}
          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 12 }}>
            <Text style={[styles.muted, { color: theme.colors.slate, fontWeight: "700", marginBottom: 4 }]}>Create ticket type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
              {events.map((ev) => (
                <Pressable key={String(ev.id)} onPress={() => setTtEventId(String(ev.id))} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: ttEventId === String(ev.id) ? theme.colors.gold : theme.colors.line, backgroundColor: ttEventId === String(ev.id) ? theme.colors.gold + "20" : "transparent" }}>
                  <Text style={{ color: ttEventId === String(ev.id) ? theme.colors.gold : theme.colors.slate, fontSize: 12, fontWeight: "700" }}>{String(ev.title)}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
              {(["REGULAR", "VIP", "VVIP", "TABLE"] as const).map((k) => (
                <Pressable key={k} onPress={() => setTtKind(k)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: ttKind === k ? theme.colors.gold : theme.colors.line, backgroundColor: ttKind === k ? theme.colors.gold + "20" : "transparent" }}>
                  <Text style={{ color: ttKind === k ? theme.colors.gold : theme.colors.slate, fontSize: 12, fontWeight: "700" }}>{k}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={inputStyle(theme)} placeholder="Name (e.g. VIP Early Bird)" placeholderTextColor={theme.colors.slate} value={ttName} onChangeText={setTtName} />
            <TextInput style={inputStyle(theme)} placeholder="Price (GHS)" placeholderTextColor={theme.colors.slate} keyboardType="decimal-pad" value={ttPrice} onChangeText={setTtPrice} />
            <TextInput style={inputStyle(theme)} placeholder="Quantity" placeholderTextColor={theme.colors.slate} keyboardType="number-pad" value={ttQty} onChangeText={setTtQty} />
            <View style={{ height: 10 }} />
            <Button theme={theme} label={createTicketTypeMutation.isPending ? "Creating..." : "Create ticket type"} disabled={!ttEventId || !ttName || !ttPrice || !ttQty || createTicketTypeMutation.isPending} onPress={() => createTicketTypeMutation.mutate()} />
          </View>
        </Card>

        {/* Vendors */}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <WalletCards size={22} color={theme.colors.gold} />
          <Text style={[styles.cardTitle, { color: theme.colors.ink, marginTop: 10 }]}>Vendors</Text>
          {vendorList.map((vendor) => (
            <View key={String(vendor.id)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.muted, { color: theme.colors.ink, fontWeight: "700" }]}>{String(vendor.businessName ?? "")}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.slate }}>{String(vendor.category ?? "")} · {String(vendor.email ?? "")}</Text>
              </View>
              <Pressable onPress={() => removeVendorMutation.mutate(String(vendor.id))} disabled={removeVendorMutation.isPending} style={{ padding: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.line }}>
                <Trash2 size={14} color={theme.colors.danger} />
              </Pressable>
            </View>
          ))}
          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 12 }}>
            <Text style={[styles.muted, { color: theme.colors.slate, fontWeight: "700", marginBottom: 4 }]}>Add vendor</Text>
            <TextInput style={inputStyle(theme)} placeholder="Vendor email" placeholderTextColor={theme.colors.slate} autoCapitalize="none" keyboardType="email-address" value={vendorEmail} onChangeText={setVendorEmail} />
            <TextInput style={inputStyle(theme)} placeholder="Business name" placeholderTextColor={theme.colors.slate} value={vendorBusiness} onChangeText={setVendorBusiness} />
            <TextInput style={inputStyle(theme)} placeholder="Category (e.g. Catering)" placeholderTextColor={theme.colors.slate} value={vendorCategory} onChangeText={setVendorCategory} />
            <View style={{ height: 10 }} />
            <Button theme={theme} label={addVendorMutation.isPending ? "Adding..." : "Add vendor"} disabled={!vendorEmail || !vendorBusiness || !vendorCategory || addVendorMutation.isPending} onPress={() => addVendorMutation.mutate()} />
          </View>
        </Card>

        {/* Vendor transactions */}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Vendor transactions</Text>
          {(transactionsQuery.data?.data ?? []).slice(0, 8).map((transaction) => (
            <View key={transaction.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.muted, { color: theme.colors.slate }]}>{transaction.vendor} — {transaction.currency} {transaction.amount}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.slate }}>{transaction.status}</Text>
              </View>
              {transaction.status === "PENDING" && (
                <Pressable onPress={() => confirmTxMutation.mutate(String(transaction.id))} disabled={confirmTxMutation.isPending} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.gold }}>
                  <Text style={{ color: "#000000", fontWeight: "800", fontSize: 12 }}>{confirmTxMutation.isPending ? "…" : "Confirm"}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </Card>

        {/* Seating */}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Seating</Text>
          {seatingData.slice(0, 8).map((seat) => (
            <Text key={String(seat.id)} style={[styles.muted, { color: theme.colors.slate }]}>Seat {String(seat.label ?? "")} · {String(seat.status ?? "")} {seat.ticketId ? "· Assigned" : ""}</Text>
          ))}
          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 12 }}>
            <Text style={[styles.muted, { color: theme.colors.slate, fontWeight: "700", marginBottom: 4 }]}>Assign seat</Text>
            <TextInput style={inputStyle(theme)} placeholder="Seat ID" placeholderTextColor={theme.colors.slate} autoCapitalize="none" value={assignSeatId} onChangeText={setAssignSeatId} />
            <TextInput style={inputStyle(theme)} placeholder="Ticket ID" placeholderTextColor={theme.colors.slate} autoCapitalize="none" value={assignTicketId} onChangeText={setAssignTicketId} />
            <View style={{ height: 10 }} />
            <Button theme={theme} label={assignSeatMutation.isPending ? "Assigning..." : "Assign seat"} disabled={!assignSeatId || !assignTicketId || assignSeatMutation.isPending} onPress={() => assignSeatMutation.mutate()} />
          </View>
        </Card>

        {/* Communications */}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <MessageSquare size={22} color={theme.colors.gold} />
          <Text style={[styles.cardTitle, { color: theme.colors.ink, marginTop: 10 }]}>Staff and vendor communication</Text>
          {(messagesQuery.data?.data ?? []).slice(0, 4).map((message) => (
            <View key={message.id} style={{ marginTop: 8 }}>
              <Text style={[styles.muted, { color: theme.colors.ink, fontWeight: "700" }]}>{message.subject}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.slate }}>{message.audience} · {message.body}</Text>
            </View>
          ))}
          <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 14 }}>
            <Text style={[styles.muted, { color: theme.colors.slate, marginBottom: 4, fontWeight: "700" }]}>Send message</Text>
            {events.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                {events.map((ev) => (
                  <Pressable key={String(ev.id)} onPress={() => setCommEventId(String(ev.id))} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: commEventId === String(ev.id) ? theme.colors.gold : theme.colors.line, backgroundColor: commEventId === String(ev.id) ? theme.colors.gold + "20" : "transparent" }}>
                    <Text style={{ color: commEventId === String(ev.id) ? theme.colors.gold : theme.colors.slate, fontSize: 12, fontWeight: "700" }}>{String(ev.title)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
              {(["ALL", "STAFF", "VENDORS"] as const).map((a) => (
                <Pressable key={a} onPress={() => setCommAudience(a)} style={{ flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: commAudience === a ? theme.colors.gold : theme.colors.line, backgroundColor: commAudience === a ? theme.colors.gold + "20" : "transparent" }}>
                  <Text style={{ color: commAudience === a ? theme.colors.gold : theme.colors.slate, fontSize: 12, fontWeight: "700" }}>{a}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput style={inputStyle(theme)} placeholder="Subject" placeholderTextColor={theme.colors.slate} value={commSubject} onChangeText={setCommSubject} />
            <TextInput style={[inputStyle(theme), { minHeight: 80, paddingTop: 12 }]} placeholder="Message body" placeholderTextColor={theme.colors.slate} multiline value={commBody} onChangeText={setCommBody} />
            <View style={{ height: 12 }} />
            <Button theme={theme} label={sendCommMutation.isPending ? "Sending..." : "Send message"} disabled={!commEventId || !commSubject || !commBody || sendCommMutation.isPending} onPress={() => sendCommMutation.mutate()} />
          </View>
        </Card>

        {/* Social analytics */}
        <Card theme={theme} style={{ marginTop: 18 }}>
          <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Social and hashtag analytics</Text>
          {socialSummary.slice(0, 4).map((item) => (
            <Text key={`${item.provider}-${item.hashtag}`} style={[styles.muted, { color: theme.colors.slate }]}>{String(item.provider)} {String(item.hashtag)} — {Number(item.reach ?? 0).toLocaleString()} reach</Text>
          ))}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function BellButton({ go, theme }: { go: (screen: string) => void; theme: AppTheme }) {
  const countQuery = useQuery({
    queryKey: ["notification-count"],
    queryFn:  async () => withMobileAuth((token) => api.notificationUnreadCount(token)),
    refetchInterval: 60_000,
    retry: false
  });
  const unread = countQuery.data?.data.count ?? 0;
  return (
    <Pressable
      onPress={() => go("notifications")}
      style={[styles.themeToggle, { backgroundColor: theme.colors.card, borderColor: theme.colors.line }]}
    >
      <Bell size={16} color={theme.colors.gold} />
      {unread > 0 && (
        <View style={[styles.notifBadge, { backgroundColor: theme.colors.gold }]}>
          <Text style={styles.notifBadgeText}>{unread > 9 ? "9+" : String(unread)}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function NotificationsScreen({ go, theme, notify }: { go: (screen: string) => void; theme: AppTheme; notify: Notify }) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn:  async () => withMobileAuth((token) => api.notifications(token)),
    retry: false
  });

  const markAllMutation = useMutation({
    mutationFn: async () => withMobileAuth((token) => api.markAllNotificationsRead(token)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notification-count"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      notify("All notifications marked as read.", undefined, "success");
    },
    onError: (error) => notify(error.message, "Error", "error")
  });

  const markOneMutation = useMutation({
    mutationFn: async (id: string) => withMobileAuth((token) => api.markNotificationRead(token, id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["notification-count"] });
    }
  });

  const notifications = listQuery.data?.data ?? [];
  const unreadCount   = notifications.filter((n) => !n.readAt).length;

  return (
    <Screen theme={theme}>
      <SubPageHeader title="Notifications" theme={theme} onBack={() => go("home")} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={listQuery.isRefetching && !listQuery.isLoading} onRefresh={() => void listQuery.refetch()} tintColor={theme.colors.gold} colors={[theme.colors.gold]} progressBackgroundColor={theme.colors.card} />}
      >
        {unreadCount > 0 && (
          <Pressable
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            style={[styles.markAllBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.line }]}
          >
            <Text style={{ color: theme.colors.gold, fontWeight: "700", fontSize: 13 }}>
              {markAllMutation.isPending ? "Marking…" : `Mark all ${unreadCount} as read`}
            </Text>
          </Pressable>
        )}
        {listQuery.isLoading && (
          <Card theme={theme}>
            <Text style={[styles.copy, { color: theme.colors.slate }]}>Loading notifications…</Text>
          </Card>
        )}
        {!listQuery.isLoading && notifications.length === 0 && (
          <Card theme={theme}>
            <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>No notifications</Text>
            <Text style={[styles.copy, { color: theme.colors.slate }]}>You're all caught up.</Text>
          </Card>
        )}
        {notifications.map((n) => (
          <Pressable key={n.id} onPress={() => { if (!n.readAt) markOneMutation.mutate(n.id); }}>
            <Card theme={theme} style={{ marginBottom: 10, opacity: markOneMutation.isPending ? 0.7 : 1 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                {!n.readAt && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.gold, marginTop: 5 }} />
                )}
                <View style={{ flex: 1, paddingLeft: n.readAt ? 18 : 0 }}>
                  <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>{n.title}</Text>
                  <Text style={[styles.copy, { color: theme.colors.slate }]}>{n.body}</Text>
                  <Text style={[styles.muted, { color: theme.colors.slate }]}>
                    {new Date(n.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    {!n.readAt ? " · Tap to mark read" : ""}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

export function OrdersScreen({ go, theme }: { go: (screen: string) => void; theme: AppTheme }) {
  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: async () => withMobileAuth((token) => api.orders(token)),
    retry: false
  });

  const orders = (ordersQuery.data?.data ?? []) as Record<string, unknown>[];

  return (
    <Screen theme={theme}>
      <SubPageHeader title="My orders" theme={theme} onBack={() => go("settings")} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={ordersQuery.isRefetching && !ordersQuery.isLoading} onRefresh={() => void ordersQuery.refetch()} tintColor={theme.colors.gold} colors={[theme.colors.gold]} progressBackgroundColor={theme.colors.card} />}
      >
        {ordersQuery.isLoading && <TicketSkeleton theme={theme} />}
        {ordersQuery.isError && (
          <Card theme={theme}>
            <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>Could not load orders</Text>
            <Text style={[styles.copy, { color: theme.colors.slate }]}>{ordersQuery.error.message}</Text>
            <View style={{ height: 12 }} />
            <Button theme={theme} label="Try again" onPress={() => void ordersQuery.refetch()} />
          </Card>
        )}
        {!ordersQuery.isLoading && orders.length === 0 && (
          <Card theme={theme}>
            <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>No orders yet</Text>
            <Text style={[styles.copy, { color: theme.colors.slate }]}>Tickets you purchase will appear here.</Text>
          </Card>
        )}
        {orders.map((order) => {
          const event   = order.event as Record<string, unknown> | undefined;
          const tickets = (order.tickets as Record<string, unknown>[] | undefined) ?? [];
          const total   = Number(order.totalAmount ?? 0);
          const currency = String(order.currency ?? "GHS");
          const status  = String(order.status ?? "");
          return (
            <Card key={String(order.id)} theme={theme} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.colors.ink }]}>{event ? String(event.title) : "Event"}</Text>
                  <Text style={[styles.muted, { color: theme.colors.slate }]}>
                    {tickets.length} ticket{tickets.length !== 1 ? "s" : ""} · {currency} {total.toFixed(2)}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: "800", color: status === "CONFIRMED" ? "#22c55e" : theme.colors.slate, paddingTop: 2 }}>{status}</Text>
              </View>
              {tickets.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {tickets.map((t) => (
                    <View key={String(t.id)} style={{ borderWidth: 1, borderColor: theme.colors.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 12, color: theme.colors.slate }}>
                        {String(t.ticketType ?? t.type ?? "Ticket")} #{String(t.id).slice(-6).toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

export function BottomNav({ active, go, canSeeOrganizer, isAuthenticated, theme }: { active: string; go: (screen: string) => void; canSeeOrganizer: boolean; isAuthenticated: boolean; theme: AppTheme }) {
  const items: Array<readonly [string, typeof Home]> = [
    ["home", Home],
    ["ticket", Ticket],
    ["invitations", Calendar],
    [isAuthenticated ? "settings" : "auth", isAuthenticated ? Settings : LogIn]
  ];
  if (canSeeOrganizer) items.push(["organizer", Users]);
  return (
    <View style={[styles.nav, { backgroundColor: theme.colors.card, borderColor: theme.colors.line }]}>
      {items.map(([screen, Icon]) => (
        <Pressable key={screen} onPress={() => go(screen)} style={styles.navItem}>
          <Icon color={active === screen ? theme.colors.gold : theme.colors.slate} size={22} />
          <Text style={{ color: active === screen ? theme.colors.gold : theme.colors.slate, fontSize: 11, fontWeight: "700", marginTop: 2 }}>{screen === "ticket" ? "Tickets" : screen === "auth" ? "Login" : screen.charAt(0).toUpperCase() + screen.slice(1)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function EventListSkeleton({ theme }: { theme: AppTheme }) {
  return (
    <View style={{ gap: 14 }}>
      {[0, 1, 2].map((item) => (
        <Card key={item} theme={theme}>
          <Skeleton theme={theme} style={{ height: 140 }} />
          <Skeleton theme={theme} style={{ height: 18, width: "75%", marginTop: 14 }} />
          <Skeleton theme={theme} style={{ height: 14, width: "52%", marginTop: 10 }} />
        </Card>
      ))}
    </View>
  );
}

function EventDetailSkeleton({ theme }: { theme: AppTheme }) {
  return (
    <View>
      <Skeleton theme={theme} style={{ height: 230, marginBottom: 20 }} />
      <Skeleton theme={theme} style={{ height: 34, width: "70%" }} />
      <Skeleton theme={theme} style={{ height: 16, width: "90%", marginTop: 14 }} />
      <Skeleton theme={theme} style={{ height: 190, marginTop: 22 }} />
    </View>
  );
}

function TicketSkeleton({ theme }: { theme: AppTheme }) {
  return (
    <View style={{ gap: 14 }}>
      {[0, 1].map((item) => (
        <Card key={item} theme={theme}>
          <Skeleton theme={theme} style={{ height: 170 }} />
          <Skeleton theme={theme} style={{ height: 18, width: "70%", marginTop: 14 }} />
        </Card>
      ))}
    </View>
  );
}

function SubPageHeader({ title, theme, onBack }: { title: string; theme: AppTheme; onBack: () => void }) {
  return (
    <View style={[styles.subPageHeader, { backgroundColor: theme.colors.surface }]}>
      <Pressable onPress={onBack} style={[styles.backButton, { borderColor: theme.colors.line, backgroundColor: theme.colors.card }]}>
        <Text style={{ color: theme.colors.gold, fontWeight: "900", fontSize: 18 }}>{"<"}</Text>
      </Pressable>
      <Text style={[styles.subPageTitle, { color: theme.colors.ink }]}>{title}</Text>
      <View style={{ width: 42 }} />
    </View>
  );
}

function inputStyle(theme: AppTheme) {
  return {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.line,
    color: theme.colors.ink,
    marginTop: 14,
    fontSize: 15
  };
}

const styles = StyleSheet.create({
  title: { fontWeight: "800", fontSize: 31, lineHeight: 37, marginBottom: 12 },
  titleSmall: { fontWeight: "800", fontSize: 25 },
  heading: { fontWeight: "800", fontSize: 24 },
  kicker: { fontSize: 13, marginBottom: 4 },
  copy: { fontSize: 15, lineHeight: 23, marginTop: 8 },
  row: { flexDirection: "row", gap: 10 },
  homeScrollContent: { paddingBottom: 156 },
  stickyFilterSurface: { paddingTop: 2, paddingBottom: 2, zIndex: 20 },
  filterScroller: { maxHeight: 48, flexGrow: 0 },
  eventListBlock: { gap: 14 },
  filterRow: { gap: 6, paddingBottom: 14 },
  filterPill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6 },
  filterDot: { width: 5, height: 5, borderRadius: 999 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  themeToggle: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  loginButton: { minHeight: 40, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  loginButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, marginBottom: 16 },
  searchInput: { flex: 1, fontSize: 15 },
  link: { textAlign: "center", marginTop: 18, fontSize: 15, fontWeight: "700" },
  linkLeft: { marginBottom: 16, fontSize: 15, fontWeight: "800" },
  subPageHeader: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, zIndex: 30 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  subPageTitle: { fontSize: 16, fontWeight: "800" },
  error: { borderRadius: 10, paddingVertical: 10, marginVertical: 12, fontSize: 15 },
  themeButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  liveCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  liveKicker: { fontWeight: "800", fontSize: 12 },
  headerLiveText: { fontWeight: "800", fontSize: 15, marginTop: 3 },
  eventImage: { height: 145, borderRadius: 12, marginBottom: 14, backgroundColor: "#111827" },
  eventBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  badge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: "800" },
  eventAction: { marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  detailImage: { height: 230, borderRadius: 18, marginBottom: 20, backgroundColor: "#111827" },
  cardRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardTitle: { fontWeight: "800", fontSize: 17 },
  muted: { marginTop: 4, fontSize: 14 },
  price: { fontWeight: "800", fontSize: 14 },
  ticketLine: { paddingVertical: 14, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperButton: { width: 32, height: 32, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qrImage: { width: 180, height: 180, alignSelf: "center", marginBottom: 18, borderRadius: 12, backgroundColor: "#ffffff" },
  qrPayload: { marginTop: 12, padding: 10, borderRadius: 10, fontSize: 11 },
  scanner: { flex: 1, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  stats: { flexDirection: "row", gap: 12, marginBottom: 14 },
  nav: { position: "absolute", left: 14, right: 14, bottom: 14, minHeight: 72, borderRadius: 20, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 6, zIndex: 50, elevation: 16 },
  navItem: { minWidth: 56, height: 56, alignItems: "center", justifyContent: "center" },
  markAllBtn: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, alignItems: "center" },
  notifBadge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  notifBadgeText: { fontSize: 9, fontWeight: "900", color: "#000000" }
});
