import { getDefaultApiBaseURL, getStoredApiBaseURL } from "../app/shared/config/api-endpoint.config";

export const environment = {
  production: false,
  get apiBaseURL(): string {
    return getStoredApiBaseURL() || getDefaultApiBaseURL(false);
  },
};
