import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class VariationService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getVariations(params: any = {}): Observable<any> {
    return this.http.get(`${this.baseURL}/api/product-variations`, {
      params: new HttpParams({ fromObject: params }),
    });
  }

  getVariationById(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/product-variations/${id}`);
  }

  getVariationUsage(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/product-variations/${id}/usage`);
  }

  createVariation(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/product-variations`, payload);
  }

  updateVariation(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/product-variations/${id}`, payload);
  }

  deleteVariation(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/product-variations/${id}`);
  }

  logLabelPrint(id: string, payload: { quantity: number; size: string }): Observable<any> {
    return this.http.post(`${this.baseURL}/api/product-variations/${id}/print-log`, payload);
  }
}
