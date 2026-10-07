import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, fromEvent } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ConnectivityService {
  readonly serverReachable$ = new BehaviorSubject<boolean | null>(null);
  readonly checking$ = new BehaviorSubject<boolean>(false);
  readonly activeApiURL$ = new BehaviorSubject<string>(environment.apiBaseURL);

  private monitorStarted = false;
  private monitorTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private http: HttpClient) {
    if (typeof window !== "undefined") {
      fromEvent(window, "online").subscribe(() => this.checkNow());
      fromEvent(window, "offline").subscribe(() => {
        this.activeApiURL$.next(environment.apiBaseURL);
        this.checking$.next(false);
        this.serverReachable$.next(false);
      });
    }
  }

  startMonitoring(intervalMs = 120000): void {
    if (this.monitorStarted) {
      return;
    }

    this.monitorStarted = true;
    this.checkNow();
    this.monitorTimer = setInterval(() => this.checkNow(false), intervalMs);
  }

  checkNow(showChecking = true): void {
    if (typeof document !== "undefined" && document.hidden && !showChecking) {
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.activeApiURL$.next(environment.apiBaseURL);
      if (showChecking) {
        this.checking$.next(false);
      }
      this.serverReachable$.next(false);
      return;
    }

    const baseURL = environment.apiBaseURL;
    this.activeApiURL$.next(baseURL);
    if (showChecking) {
      this.checking$.next(true);
    }

    this.http.get<{ success: boolean; status: string }>(`${baseURL}/api/health`).subscribe({
      next: () => {
        if (showChecking) {
          this.checking$.next(false);
        }
        this.serverReachable$.next(true);
      },
      error: () => {
        // Fallback probe for native apps
        const isNative = typeof window !== "undefined" && typeof (window as any).Capacitor !== "undefined";
        const hasManualOverride = typeof window !== "undefined" && !!window.localStorage.getItem("babashop.apiBaseURLOverride");

        if (isNative && !hasManualOverride) {
          const alternateURL = baseURL.includes("onrender.com")
            ? "http://192.168.31.47:3000"
            : "https://myshop-amdm.onrender.com";

          this.http.get<{ success: boolean; status: string }>(`${alternateURL}/api/health`).subscribe({
            next: () => {
              try {
                window.localStorage.setItem("babashop.apiBaseURLOverride", alternateURL);
                window.localStorage.setItem("babashop.apiMode", alternateURL.includes("192.168") ? "lan" : "render");
              } catch (_) {}
              this.activeApiURL$.next(alternateURL);
              if (showChecking) {
                this.checking$.next(false);
              }
              this.serverReachable$.next(true);
            },
            error: () => {
              if (showChecking) {
                this.checking$.next(false);
              }
              this.serverReachable$.next(false);
            },
          });
          return;
        }

        if (showChecking) {
          this.checking$.next(false);
        }
        this.serverReachable$.next(false);
      },
    });
  }
}
