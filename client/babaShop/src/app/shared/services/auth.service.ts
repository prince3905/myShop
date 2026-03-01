// auth.service.ts

import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap, catchError, finalize } from "rxjs/operators";
import { environment } from "../../../environments/environment";
import { throwError } from "rxjs";

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: any;
}

interface AuthenticatedResponse {
  success: boolean;
  message?: string;
  user: any;
}

interface SessionsResponse {
  success: boolean;
  message?: string;
  sessions: any[];
  count: number;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  public showLoader: boolean = false;
  private TOKEN_KEY: string = "token";
  private USER_KEY: string = "user";

  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

 private saveToken(token: string) {
  localStorage.setItem(this.TOKEN_KEY, token);
}

isLoggedIn(): boolean {
  return !!this.getToken();
}

login(shopCode: string, email: string, password: string) {
  this.showLoader = true;
  console.log("[FLOW][FE][AUTH][LOGIN] request", { email, shopCode });

  return this.http
    .post<LoginResponse>(`${this.baseURL}/api/auth/login`, {
      shopCode,
      email,
      password,
    })
    .pipe(
      finalize(() => {
        this.showLoader = false;
      }),
      tap((res) => {
        if (res.success && res.token && res.user) {
          console.log("[FLOW][FE][AUTH][LOGIN] success", {
            userId: res.user?.id,
            role: res.user?.role,
            shop: res.user?.shop,
            shopCode: res.user?.shopCode,
          });
          this.saveToken(res.token);
          this.user = res.user;
        }
      })
    );
}

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  removeToken() {
    return localStorage.removeItem(this.TOKEN_KEY);
  }

  removeUser() {
    return localStorage.removeItem(this.USER_KEY);
  }

  removeSelectedShop() {
    this.setActiveShop(null);
  }

  set user(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  getCurrentUser(): any | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  setActiveShop(shopId: string | null, shopCode: string | null = null) {
    const user = this.getCurrentUser();
    if (!user) return;
    user.shop = shopId || null;
    user.shopCode = shopCode || null;
    this.user = user;
  }

  getShopId(): string | null {
    const user = this.getCurrentUser();
    return user?.shop || null;
  }


 getUserRole(): string | null {
  return this.getCurrentUser()?.role || null;
}

  

  authenticated() {
    // this.showLoader = true;
    return this.http
      .get<AuthenticatedResponse>(`${this.baseURL}/api/auth/authenticated`)
      .pipe(
        finalize(() => {
          this.showLoader = false;
        }),
        tap(({ user }) => {
          this.user = user;
        }),
        catchError((err) => {
          return throwError(err);
        }),
      );
  }

  getProfile() {
    return this.http
      .get<AuthenticatedResponse>(`${this.baseURL}/api/auth/authenticated`)
      .pipe(
        tap(({ user }) => {
          this.user = user;
        }),
      );
  }

  updateProfile(payload: any) {
    return this.http
      .put<AuthenticatedResponse>(`${this.baseURL}/api/auth/profile`, payload)
      .pipe(
        tap(({ user }) => {
          this.user = user;
        }),
      );
  }

  getActiveSessions() {
    return this.http.get<SessionsResponse>(`${this.baseURL}/api/auth/sessions`);
  }

  changePassword(payload: { currentPassword: string; newPassword: string }) {
    return this.http.put<any>(`${this.baseURL}/api/auth/change-password`, payload);
  }

  updateTwoFactor(enabled: boolean) {
    return this.http.put<any>(`${this.baseURL}/api/auth/2fa`, { enabled });
  }

  logoutAllDevices() {
    return this.http.post<any>(`${this.baseURL}/api/auth/logout-all`, {});
  }

  getSettingsOverview() {
    return this.http.get<any>(`${this.baseURL}/api/auth/settings-overview`);
  }

  updateNotificationSettings(payload: any) {
    return this.http.put<any>(`${this.baseURL}/api/auth/settings/notifications`, payload);
  }

  updateAppPreferences(payload: any) {
    return this.http.put<any>(`${this.baseURL}/api/auth/settings/preferences`, payload);
  }

  updateShopSettings(payload: any) {
    return this.http.put<any>(`${this.baseURL}/api/auth/settings/shop`, payload);
  }

  updateIntegrations(payload: any) {
    return this.http.put<any>(`${this.baseURL}/api/auth/settings/integrations`, payload);
  }

  updateBackupSettings(payload: any) {
    return this.http.put<any>(`${this.baseURL}/api/auth/settings/backup`, payload);
  }

  runBackupNow() {
    return this.http.post<any>(`${this.baseURL}/api/auth/settings/backup/run`, {});
  }

  getAuditLogs() {
    return this.http.get<any>(`${this.baseURL}/api/auth/settings/audit-logs`);
  }

  deactivateAccount() {
    return this.http.post<any>(`${this.baseURL}/api/auth/settings/danger/account-deactivate`, {});
  }

  deactivateShop() {
    return this.http.post<any>(`${this.baseURL}/api/auth/settings/danger/shop-deactivate`, {});
  }

  logout() {
    return this.http.get<any>(`${this.baseURL}/api/auth/logout`).pipe(
      finalize(() => {
        this.removeToken();
        this.removeUser();
        this.removeSelectedShop();
      }),
    );
  }

  isSuperAdmin(): boolean {
  const user = this.getCurrentUser() || {};
  return user.role === 'SUPER_ADMIN';
}

  
}
