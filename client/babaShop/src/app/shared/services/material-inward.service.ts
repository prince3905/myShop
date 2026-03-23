import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class MaterialInwardService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getSummary(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/material-inwards/summary`);
  }

  getInwards(filters: any = {}): Observable<any> {
    let params = new HttpParams();
    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];
      if (value !== null && value !== undefined && `${value}`.trim?.() !== "" && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return this.http.get(`${this.baseURL}/api/material-inwards`, { params });
  }

  createInward(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/material-inwards`, payload);
  }

  updateInward(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/material-inwards/${id}`, payload);
  }

  deleteInward(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/material-inwards/${id}`);
  }
}
