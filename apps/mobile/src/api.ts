import { VelvetApiClient } from "@velvet-rope/shared";
import { NativeModules, Platform } from "react-native";

declare const process: { env?: { EXPO_PUBLIC_API_BASE_URL?: string; EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY?: string } };
declare const __DEV__: boolean;

function getMetroHostApiUrl() {
  const scriptURL = (NativeModules.SourceCode?.scriptURL ?? "") as string;
  const host = scriptURL.match(/^https?:\/\/([^/:]+)/)?.[1];
  if (host && host !== "localhost" && host !== "127.0.0.1") return `http://${host}:4000/api`;
  if (Platform.OS === "android") return "http://10.0.2.2:4000/api";
  return "http://localhost:4000/api";
}

const envApiBaseUrl = process.env?.EXPO_PUBLIC_API_BASE_URL?.trim();

export const apiBaseUrl = envApiBaseUrl || (__DEV__ ? getMetroHostApiUrl() : "https://api.velvetrope.app/api");
export const paystackPublicKey = process.env?.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY?.trim() ?? "";

export const api = new VelvetApiClient(apiBaseUrl);
