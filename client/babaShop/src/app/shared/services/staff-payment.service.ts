import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class StaffPaymentService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getSummary(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/staff-payments/summary`);
  }

  private serializeFilterValue(value: any): string {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, "0");
      const d = String(value.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return String(value);
  }

  getPayments(filters: any = {}): Observable<any> {
    let params = new HttpParams();
    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];
      if (value !== null && value !== undefined && `${value}`.trim?.() !== "" && value !== "") {
        params = params.set(key, this.serializeFilterValue(value));
      }
    });
    return this.http.get(`${this.baseURL}/api/staff-payments`, { params });
  }

  createPayment(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/staff-payments`, payload);
  }

  updatePayment(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/staff-payments/${id}`, payload);
  }

  deletePayment(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/staff-payments/${id}`);
  }
}
