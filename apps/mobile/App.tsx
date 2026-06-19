import { useCallback, useEffect, useState } from "react";
import { LogBox, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { PaystackProvider } from "react-native-paystack-webview";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { paystackPublicKey } from "./src/api";
import { ToastBanner, type ToastKind, type ToastMessage } from "./src/components";
import { getTheme, type ThemeMode } from "./src/theme";
import {
  AuthScreen,
  BottomNav,
  EventDetailsScreen,
  HomeFeedScreen,
  InvitationsScreen,
  NotificationsScreen,
  OrdersScreen,
  OrganizerQuickScreen,
  ScannerScreen,
  SettingsScreen,
  TicketScreen
} from "./src/screens";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      refetchOnReconnect: false,
      retry: 1
    }
  }
});

LogBox.ignoreLogs(["SafeAreaView has been deprecated"]);

export default function App() {
  const systemDark                             = useColorScheme() === "dark";
  const [themeMode, setThemeMode]             = useState<ThemeMode>("dark");
  const [screen, setScreen]                   = useState("home");
  const [selectedSlug, setSelectedSlug]       = useState<string | null>(null);
  const [role, setRole]                       = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [toast, setToast]                     = useState<ToastMessage | null>(null);

  const theme           = getTheme(themeMode, systemDark);
  const canSeeOrganizer = role === "ORGANIZER" || role === "ADMIN" || role === "SUPER_ADMIN";
  const showNav         = !["auth", "event", "scanner", "notifications", "orders"].includes(screen);

  useEffect(() => {
    void (async () => {
      const [rawUser, rawTheme] = await Promise.all([
        SecureStore.getItemAsync("velvet_user"),
        AsyncStorage.getItem("velvet_theme")
      ]);
      if (rawUser) {
        const user = JSON.parse(rawUser) as { role?: string };
        setRole(user.role ?? null);
        setIsAuthenticated(true);
      }
      if (rawTheme === "light" || rawTheme === "dark" || rawTheme === "system") {
        setThemeMode(rawTheme as ThemeMode);
      }
    })();
  }, []);

  const updateTheme = useCallback(async (next: ThemeMode) => {
    setThemeMode(next);
    await AsyncStorage.setItem("velvet_theme", next);
  }, []);

  const openEvent = (slug: string) => {
    setSelectedSlug(slug);
    setScreen("event");
  };

  const notify = useCallback((message: string, title?: string, kind: ToastKind = "info") => {
    setToast({ id: Date.now(), message, title, kind });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaystackProvider
          publicKey={paystackPublicKey || "pk_test_missing"}
          currency="GHS"
          defaultChannels={["card", "mobile_money", "bank", "bank_transfer"]}
        >
          {screen === "home" && (
            <HomeFeedScreen
              go={setScreen}
              openEvent={openEvent}
              theme={theme}
              isAuthenticated={isAuthenticated}
              themeMode={themeMode}
              setThemeMode={updateTheme}
            />
          )}
          {screen === "auth" && (
            <AuthScreen
              go={setScreen}
              onRole={(nextRole) => { setRole(nextRole); setIsAuthenticated(Boolean(nextRole)); }}
              theme={theme}
              notify={notify}
            />
          )}
          {screen === "event" && (
            <EventDetailsScreen
              slug={selectedSlug}
              go={setScreen}
              theme={theme}
              isAuthenticated={isAuthenticated}
              notify={notify}
            />
          )}
          {screen === "ticket"      && <TicketScreen      go={setScreen} theme={theme} notify={notify} />}
          {screen === "invitations" && <InvitationsScreen go={setScreen} theme={theme} />}
          {screen === "settings"    && (
            <SettingsScreen
              go={setScreen}
              onRole={(nextRole) => { setRole(nextRole); setIsAuthenticated(Boolean(nextRole)); }}
              theme={theme}
              notify={notify}
            />
          )}
          {screen === "scanner"       && <ScannerScreen        go={setScreen} theme={theme} notify={notify} />}
          {screen === "notifications" && <NotificationsScreen   go={setScreen} theme={theme} notify={notify} />}
          {screen === "orders"        && <OrdersScreen          go={setScreen} theme={theme} />}
          {screen === "organizer" && canSeeOrganizer && (
            <OrganizerQuickScreen go={setScreen} theme={theme} />
          )}
          {showNav && (
            <BottomNav
              active={screen}
              go={setScreen}
              canSeeOrganizer={canSeeOrganizer}
              isAuthenticated={isAuthenticated}
              theme={theme}
            />
          )}
          <ToastBanner toast={toast} theme={theme} onDismiss={dismissToast} />
          <StatusBar style={theme.dark ? "light" : "dark"} />
        </PaystackProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
