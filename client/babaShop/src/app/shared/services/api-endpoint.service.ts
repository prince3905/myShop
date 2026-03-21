import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import {
  API_MODE_OPTIONS,
  API_MODE_STORAGE_KEY,
  API_OVERRIDE_STORAGE_KEY,
  ApiMode,
  DEFAULT_NGROK_URL,
  getStoredApiBaseURL,
  getStoredApiMode,
  normalizeApiURL,
  resolveApiURLForMode,
} from "../config/api-endpoint.config";

@Injectable({
  providedIn: "root",
})
export class ApiEndpointService {
  readonly apiModeOptions = API_MODE_OPTIONS;
  readonly defaultNgrokURL = DEFAULT_NGROK_URL;

  getActiveApiURL(): string {
    return environment.apiBaseURL;
  }

  getSettings(): { apiMode: ApiMode; customApiURL: string; activeApiURL: string } {
    const apiMode = getStoredApiMode();
    const storedApiURL = getStoredApiBaseURL() || "";

    return {
      apiMode,
      customApiURL: storedApiURL || this.defaultNgrokURL,
      activeApiURL: this.getActiveApiURL(),
    };
  }

  saveSettings(apiMode: ApiMode, customApiURL = ""): { success: boolean; resolvedURL: string } {
    const effectiveCustomURL =
      apiMode === "ngrok" ? (normalizeApiURL(customApiURL) || this.defaultNgrokURL) : customApiURL;
    const resolvedURL = resolveApiURLForMode(apiMode, effectiveCustomURL);

    if ((apiMode === "custom" || apiMode === "ngrok") && !resolvedURL) {
      return { success: false, resolvedURL: "" };
    }

    try {
      localStorage.setItem(API_MODE_STORAGE_KEY, apiMode);
      if (resolvedURL) {
        localStorage.setItem(API_OVERRIDE_STORAGE_KEY, resolvedURL);
      } else {
        localStorage.removeItem(API_OVERRIDE_STORAGE_KEY);
      }
    } catch {
      return { success: false, resolvedURL: "" };
    }

    return {
      success: true,
      resolvedURL: resolvedURL || this.getActiveApiURL(),
    };
  }

  clearOverride(): void {
    try {
      localStorage.setItem(API_MODE_STORAGE_KEY, "auto");
      localStorage.removeItem(API_OVERRIDE_STORAGE_KEY);
    } catch {}
  }

  normalizeCustomURL(value: string): string {
    return normalizeApiURL(value);
  }
}
