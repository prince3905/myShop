import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class DailyExpenseService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getSummary(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/daily-expenses/summary`);
  }

  getExpenses(filters: any = {}): Observable<any> {
    let params = new HttpParams();
    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];
      if (value !== null && value !== undefined && `${value}`.trim?.() !== "" && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return this.http.get(`${this.baseURL}/api/daily-expenses`, { params });
  }

  createExpense(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/daily-expenses`, payload);
  }

  updateExpense(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/daily-expenses/${id}`, payload);
  }

  deleteExpense(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/daily-expenses/${id}`);
  }
}
