import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class FraudDetectionService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getFraudDetectionReport(
    days?: number | null,
    shopId?: string,
    startDate?: Date | null,
    endDate?: Date | null
  ): Observable<any> {
    let params = new HttpParams();
    
    // Use date range if provided, otherwise use days
    if (startDate && endDate) {
      params = params.set("startDate", startDate.toISOString());
      params = params.set("endDate", endDate.toISOString());
    } else if (days) {
      params = params.set("days", days.toString());
    } else {
      params = params.set("days", "7");
    }
    
    if (shopId) {
      params = params.set("shopId", shopId);
    }
    
    return this.http.get(`${this.baseURL}/api/fraud-detection`, { params });
  }
}
