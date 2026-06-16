import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AppTheme } from "./theme";

export type ToastKind = "success" | "error" | "info";

export type ToastMessage = {
  id: number;
  title?: string;
  message: string;
  kind?: ToastKind;
};

export function Screen({ children, theme }: { children: ReactNode; theme: AppTheme }) {
  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surface }]}>{children}</SafeAreaView>;
}

export function Button({ label, onPress, secondary, disabled, theme }: { label: string; onPress?: () => void; secondary?: boolean; disabled?: boolean; theme: AppTheme }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: theme.colors.gold, opacity: disabled ? 0.55 : 1 },
        secondary && { backgroundColor: theme.colors.muted, borderWidth: 1, borderColor: theme.colors.line }
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: theme.colors.ink }, !secondary && { color: "#0A0A0F" }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, theme, style }: { children: ReactNode; theme: AppTheme; style?: ViewStyle }) {
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.line, shadowColor: theme.dark ? "#000000" : "#111827" }, style]}>
      {children}
    </View>
  );
}

export function Stat({ label, value, theme }: { label: string; value: string; theme: AppTheme }) {
  return (
    <Card theme={theme} style={styles.statCard}>
      <Text style={[styles.statValue, { color: theme.colors.ink }]}>{value}</Text>
      <Text style={[styles.muted, { color: theme.colors.slate }]}>{label}</Text>
    </Card>
  );
}

export function Skeleton({ theme, style }: { theme: AppTheme; style?: ViewStyle }) {
  return <View style={[styles.skeleton, { backgroundColor: theme.colors.muted }, style]} />;
}

export function ToastBanner({ toast, theme, onDismiss }: { toast: ToastMessage | null; theme: AppTheme; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, toast.kind === "error" ? 5000 : 3200);
    return () => clearTimeout(timer);
  }, [onDismiss, toast]);

  if (!toast) return null;

  const accent = toast.kind === "error" ? theme.colors.danger : toast.kind === "success" ? theme.colors.success : theme.colors.gold;

  return (
    <Pressable onPress={onDismiss} style={[styles.toast, { backgroundColor: theme.colors.card, borderColor: accent, shadowColor: theme.dark ? "#000000" : "#111827" }]}>
      {toast.title ? <Text style={[styles.toastTitle, { color: theme.colors.ink }]}>{toast.title}</Text> : null}
      <Text style={[styles.toastText, { color: theme.colors.slate }]}>{toast.message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2
  },
  statCard: {
    flex: 1
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800"
  },
  muted: {
    marginTop: 3,
    fontSize: 13
  },
  skeleton: {
    borderRadius: 12,
    opacity: 0.75
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 52,
    zIndex: 100,
    elevation: 20,
    borderLeftWidth: 4,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: "900"
  },
  toastText: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600"
  }
});
