import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class StaffWorkItemService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getSummary(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/staff-work-items/summary`);
  }

  getItems(filters: any = {}): Observable<any> {
    let params = new HttpParams();
    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];
      if (value !== null && value !== undefined && `${value}`.trim?.() !== "" && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return this.http.get(`${this.baseURL}/api/staff-work-items`, { params });
  }

  createItem(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/staff-work-items`, payload);
  }

  updateItem(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/staff-work-items/${id}`, payload);
  }

  deleteItem(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/staff-work-items/${id}`);
  }
}
