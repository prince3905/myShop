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
        if (showChecking) {
          this.checking$.next(false);
        }
        this.serverReachable$.next(false);
      },
    });
  }
}
