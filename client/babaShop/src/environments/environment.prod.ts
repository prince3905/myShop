import { getDefaultApiBaseURL, getStoredApiBaseURL } from "../app/shared/config/api-endpoint.config";

export const environment = {
  production: true,
  get apiBaseURL(): string {
    return getStoredApiBaseURL() || getDefaultApiBaseURL(true);
  },
};
