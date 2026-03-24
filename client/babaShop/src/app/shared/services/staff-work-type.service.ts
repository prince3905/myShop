import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class StaffWorkTypeService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getWorkTypes(filters: any = {}): Observable<any> {
    let params = new HttpParams();
    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];
      if (value !== null && value !== undefined && `${value}`.trim?.() !== "" && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return this.http.get(`${this.baseURL}/api/staff-work-types`, { params });
  }

  createWorkType(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/staff-work-types`, payload);
  }

  updateWorkType(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/staff-work-types/${id}`, payload);
  }

  deleteWorkType(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/staff-work-types/${id}`);
  }
}
