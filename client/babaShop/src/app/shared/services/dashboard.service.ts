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

  getKpisByRange(range: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/kpis`, {
      params: { range },
    });
  }

  getOverview(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/overview`);
  }

  getOverviewByRange(range: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/overview`, {
      params: { range },
    });
  }

  getTrends(days = 7): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/trends`, {
      params: { days },
    });
  }

  getTrendsByRange(range: string, days?: number): Observable<any> {
    const params: any = { range };
    if (days) {
      params.days = days;
    }
    return this.http.get(`${this.baseURL}/api/dashboard/trends`, { params });
  }

  getPurchaseAnalytics(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/purchase-analytics`);
  }

  getReturnAnalytics(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/return-analytics`);
  }

  getPurchaseReturnAnalytics(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/purchase-return-analytics`);
  }

  getPaymentCollectionAnalyticsByRange(range: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/dashboard/payment-collection-analytics`, {
      params: { range },
    });
  }
}
