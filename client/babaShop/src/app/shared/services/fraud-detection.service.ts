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

  getFraudDetectionReport(days: number = 7, shopId?: string): Observable<any> {
    let params = new HttpParams().set("days", days.toString());
    if (shopId) {
      params = params.set("shopId", shopId);
    }
    return this.http.get(`${this.baseURL}/api/fraud-detection/report`, { params });
  }
}
