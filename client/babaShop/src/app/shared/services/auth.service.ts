import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap, catchError, finalize } from "rxjs/operators";
import { environment } from "../../../environments/environment";
import { throwError, BehaviorSubject } from "rxjs";
import { Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ROLE_FEATURE_POLICY } from "../config/role-feature-policy";

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
  private readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private activityListenersBound = false;
  private currentShopSubject = new BehaviorSubject<string | null>(null);
  currentShop$ = this.currentShopSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {
    this.currentShopSubject.next(this.getShopId());
    this.initializeSessionWatch();
  }

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  private saveToken(token: string) {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.forceLogout("Session expired. Please login again.");
      return false;
    }

    return true;
  }

  login(shopCode: string, email: string, password: string) {
    this.showLoader = true;

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
            this.saveToken(res.token);
            this.user = res.user;
            this.startSessionWatch();
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
    const result = localStorage.removeItem(this.USER_KEY);
    this.currentShopSubject.next(null);
    return result;
  }

  removeSelectedShop() {
    const user = this.getCurrentUser();
    if (!user) {
      this.currentShopSubject.next(null);
      return;
    }
    this.setActiveShop(null);
  }

  set user(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentShopSubject.next(user?.shop || null);
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
    this.currentShopSubject.next(shopId || null);
  }

  getShopId(): string | null {
    const user = this.getCurrentUser();
    return user?.shop || null;
  }
  getUserRole(): string | null {
    return this.getCurrentUser()?.role || null;
  }

  authenticated() {
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

  updateRoleFeaturePolicy(payload: any) {
    return this.http.put<any>(`${this.baseURL}/api/auth/settings/role-feature-policy`, payload);
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
        this.clearLocalSession();
      }),
    );
  }

  isSuperAdmin(): boolean {
  const user = this.getCurrentUser() || {};
  return user.role === 'SUPER_ADMIN';
}

  isGlobalReadOnlyMode(): boolean {
    const user = this.getCurrentUser() || {};
    return user.role === "SUPER_ADMIN" && !user.shop;
  }

  canViewSensitivePricing(): boolean {
    const role = this.getUserRole() || "";
    if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
      return false;
    }
    return this.can("dashboard.financial");
  }

  can(featureKey: string): boolean {
    const user = this.getCurrentUser() || {};
    const role = user?.role || "";
    if (!role || !featureKey) {
      return false;
    }

    const allowed = Array.isArray(user?.allowedFeatures) && user.allowedFeatures.length
      ? user.allowedFeatures
      : (ROLE_FEATURE_POLICY[role] || []);
    return allowed.includes("*") || allowed.includes(featureKey);
  }

  getRoleAccessMessage(expectedRoles: string[] = []): string {
    const role = this.getUserRole() || "USER";
    const readableExpected = expectedRoles.length ? expectedRoles.join(", ") : "authorized users";

    if (role === "STAFF") {
      return `STAFF access limited hai. Is page ke liye allowed role: ${readableExpected}.`;
    }

    if (role === "MANAGER") {
      return `MANAGER role se is page ka access allowed nahi hai. Required role: ${readableExpected}.`;
    }

    if (role === "ADMIN") {
      return `ADMIN role se bhi is page ka access allowed nahi hai. Required role: ${readableExpected}.`;
    }

    if (role === "SUPER_ADMIN") {
      return `Current mode me is page ka access blocked hai. Required role: ${readableExpected}.`;
    }

    return `Aapke current role se is page ka access allowed nahi hai. Required role: ${readableExpected}.`;
  }

  initializeSessionWatch(): void {
    this.bindActivityListeners();
    if (this.getToken()) {
      this.startSessionWatch();
    }
  }

  private startSessionWatch(): void {
    this.bindActivityListeners();
    this.resetIdleTimer();
    this.scheduleExpiryLogout();
  }

  private bindActivityListeners(): void {
    if (this.activityListenersBound || typeof window === "undefined") {
      return;
    }

    const events = ["click", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => {
      window.addEventListener(eventName, () => this.handleUserActivity(), true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.handleUserActivity();
      }
    });
    this.activityListenersBound = true;
  }

  private handleUserActivity(): void {
    if (!this.getToken()) {
      return;
    }
    if (this.isTokenExpired(this.getToken())) {
      this.forceLogout("Session expired. Please login again.");
      return;
    }
    this.resetIdleTimer();
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }

    this.idleTimer = setTimeout(() => {
      this.forceLogout("Session timed out due to inactivity.");
    }, this.IDLE_TIMEOUT_MS);
  }

  private scheduleExpiryLogout(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
    }

    const expiresAt = this.getTokenExpiryTime(this.getToken());
    if (!expiresAt) {
      return;
    }

    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) {
      this.forceLogout("Session expired. Please login again.");
      return;
    }

    this.expiryTimer = setTimeout(() => {
      this.forceLogout("Session expired. Please login again.");
    }, msUntilExpiry);
  }

  private getTokenExpiryTime(token: string | null): number | null {
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split(".")[1] || ""));
      const exp = Number(payload?.exp || 0);
      return exp > 0 ? exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string | null): boolean {
    const expiresAt = this.getTokenExpiryTime(token);
    return !!expiresAt && Date.now() >= expiresAt;
  }

  private clearLocalSession(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    this.removeToken();
    localStorage.removeItem(this.USER_KEY);
    this.currentShopSubject.next(null);
  }

  forceLogout(message?: string): void {
    this.clearLocalSession();
    if (message) {
      this.snackBar.open(message, "Close", { duration: 3200 });
    }
    if (this.router.url !== "/login") {
      this.router.navigate(["/login"]);
    }
  }
}
