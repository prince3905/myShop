import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class DashboardService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getKpis(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/kpis`);
  }

  getTrends(days = 7): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/trends`, {
      params: { days },
    });
  }

  getPurchaseAnalytics(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/purchase-analytics`);
  }

  getReturnAnalytics(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/return-analytics`);
  }
}
