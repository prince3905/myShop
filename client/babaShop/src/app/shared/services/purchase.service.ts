import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class PurchaseService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  listPurchases(params: any = {}): Observable<any> {
    let httpParams = new HttpParams();
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value === null || value === undefined || value === "") return;
      httpParams = httpParams.set(key, String(value));
    });

    return this.http.get(`${this.baseURL}/api/purchases`, {
      params: httpParams,
    });
  }

  createDraft(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/purchases`, payload);
  }

  confirmPurchase(id: string): Observable<any> {
    return this.http.post(`${this.baseURL}/api/purchases/${id}/confirm`, {});
  }

  getPurchaseById(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/purchases/${id}`);
  }

  updateDraft(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/purchases/${id}`, payload);
  }

  cancelDraft(id: string): Observable<any> {
    return this.http.patch(`${this.baseURL}/api/purchases/${id}/cancel`, {});
  }

  createPurchaseReturn(purchaseId: string, payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/purchases/${purchaseId}/returns`, payload);
  }

  listPurchaseReturns(purchaseId: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/purchases/${purchaseId}/returns`);
  }
}
