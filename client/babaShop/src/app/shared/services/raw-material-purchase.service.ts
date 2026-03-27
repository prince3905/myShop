import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { AuthService } from "./auth.service";

@Injectable({
  providedIn: "root",
})
export class RawMaterialPurchaseService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  listPurchases(filters: any = {}): Observable<any> {
    let params = new HttpParams();
    Object.keys(filters || {}).forEach((key) => {
      const value = filters[key];
      if (value !== null && value !== undefined && `${value}`.trim?.() !== "" && value !== "") {
        params = params.set(key, String(value));
      }
    });
    const selectedShop = this.authService.getShopId();
    if (selectedShop) {
      params = params.set("shopId", selectedShop);
    }
    return this.http.get(`${this.baseURL}/api/raw-material-purchases`, { params });
  }

  createPurchase(payload: any): Observable<any> {
    const selectedShop = this.authService.getShopId();
    const finalPayload = selectedShop ? { ...payload, shop: selectedShop } : payload;
    return this.http.post(`${this.baseURL}/api/raw-material-purchases`, finalPayload);
  }

  updatePurchase(id: string, payload: any): Observable<any> {
    const selectedShop = this.authService.getShopId();
    const finalPayload = selectedShop ? { ...payload, shop: selectedShop } : payload;
    return this.http.put(`${this.baseURL}/api/raw-material-purchases/${id}`, finalPayload);
  }

  approvePurchase(id: string): Observable<any> {
    const selectedShop = this.authService.getShopId();
    const payload = selectedShop ? { shop: selectedShop } : {};
    return this.http.patch(`${this.baseURL}/api/raw-material-purchases/${id}/approve`, payload);
  }

  addPayment(id: string, payload: any): Observable<any> {
    const selectedShop = this.authService.getShopId();
    const finalPayload = selectedShop ? { ...payload, shop: selectedShop } : payload;
    return this.http.post(`${this.baseURL}/api/raw-material-purchases/${id}/payment`, finalPayload);
  }

  cancelPurchase(id: string): Observable<any> {
    const selectedShop = this.authService.getShopId();
    const payload = selectedShop ? { shop: selectedShop } : {};
    return this.http.patch(`${this.baseURL}/api/raw-material-purchases/${id}/cancel`, payload);
  }
}
