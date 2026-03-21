export type ApiMode = "auto" | "local" | "emulator" | "ngrok" | "custom";

export const API_MODE_STORAGE_KEY = "babashop.apiMode";
export const API_OVERRIDE_STORAGE_KEY = "babashop.apiBaseURLOverride";
export const DEFAULT_NGROK_URL = "https://example.ngrok-free.app";

export const API_MODE_OPTIONS: Array<{ value: ApiMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "local", label: "Localhost" },
  { value: "emulator", label: "Android Emulator" },
  { value: "ngrok", label: "ngrok" },
  { value: "custom", label: "Custom URL" },
];

export const normalizeApiURL = (value: string): string =>
  `${value || ""}`.trim().replace(/\/+$/, "");

export const getCurrentOrigin = (): string =>
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

export const isNativeApp = (): boolean =>
  typeof window !== "undefined" && typeof (window as any).Capacitor !== "undefined";

export const isLocalFrontend = (): boolean => {
  const currentOrigin = getCurrentOrigin();
  return (
    currentOrigin.includes("localhost:4200")
    || currentOrigin.includes("127.0.0.1:4200")
    || currentOrigin.includes("localhost:3000")
    || currentOrigin.includes("127.0.0.1:3000")
  );
};

export const getStoredApiBaseURL = (): string | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(API_OVERRIDE_STORAGE_KEY);
    return raw ? normalizeApiURL(raw) : null;
  } catch {
    return null;
  }
};

export const getStoredApiMode = (): ApiMode => {
  if (typeof window === "undefined") return "auto";

  try {
    const raw = window.localStorage.getItem(API_MODE_STORAGE_KEY) as ApiMode | null;
    return API_MODE_OPTIONS.some((option) => option.value === raw) ? (raw as ApiMode) : "auto";
  } catch {
    return "auto";
  }
};

export const resolveApiURLForMode = (mode: ApiMode, customURL = ""): string => {
  if (mode === "local") {
    return "http://localhost:3000";
  }
  if (mode === "emulator") {
    return "http://10.0.2.2:3000";
  }
  if (mode === "ngrok") {
    return DEFAULT_NGROK_URL;
  }
  if (mode === "custom") {
    return normalizeApiURL(customURL);
  }

  return "";
};

export const getDefaultApiBaseURL = (production = false): string => {
  if (isNativeApp()) {
    return DEFAULT_NGROK_URL;
  }

  return !production && isLocalFrontend() ? "http://localhost:3000" : getCurrentOrigin();
};
