import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import {
  API_MODE_OPTIONS,
  API_MODE_STORAGE_KEY,
  API_OVERRIDE_STORAGE_KEY,
  ApiMode,
  DEFAULT_RENDER_URL,
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
  readonly defaultRenderURL = DEFAULT_RENDER_URL;

  getActiveApiURL(): string {
    return environment.apiBaseURL;
  }

  getSettings(): { apiMode: ApiMode; customApiURL: string; activeApiURL: string } {
    const apiMode = getStoredApiMode();
    const storedApiURL = getStoredApiBaseURL() || "";

    return {
      apiMode,
      customApiURL: storedApiURL || this.defaultRenderURL,
      activeApiURL: this.getActiveApiURL(),
    };
  }

  saveSettings(apiMode: ApiMode, customApiURL = ""): { success: boolean; resolvedURL: string } {
    const effectiveCustomURL =
      apiMode === "render" ? (normalizeApiURL(customApiURL) || this.defaultRenderURL) : customApiURL;
    const resolvedURL = resolveApiURLForMode(apiMode, effectiveCustomURL);

    if ((apiMode === "custom" || apiMode === "render") && !resolvedURL) {
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
