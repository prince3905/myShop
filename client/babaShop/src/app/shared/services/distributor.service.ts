import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { AuthService } from "./auth.service";

@Injectable({
  providedIn: "root",
})
export class DistributorService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getDistributor(data: any) {
    let params = new HttpParams({ fromObject: data || {} });
    const selectedShop = this.authService.getShopId();
    if (selectedShop) {
      params = params.set("shopId", selectedShop);
    }
    // console.log(params);
    return this.http.get(`${this.baseURL}/api/distributor`, { params: params });
  }

  addDistributor(data: any) {
    return this.http.post(`${this.baseURL}/api/distributor`, data);
  }

  getDistributorSuggestionName(searchTerm: string) {
    console.log(searchTerm);
    const selectedShop = this.authService.getShopId();
    const shopQuery = selectedShop ? `&shopId=${selectedShop}` : "";
    return this.http.get(
      `${this.baseURL}/api/distributor/distributor-suggestions?term=${searchTerm}${shopQuery}`,
    );
  }

  getDistributorSuggestionPhone(searchTerm: number) {
    console.log(searchTerm);
    const selectedShop = this.authService.getShopId();
    const shopQuery = selectedShop ? `&shopId=${selectedShop}` : "";
    return this.http.get(
      `${this.baseURL}/api/distributor/distributor-suggestions?term=${searchTerm}${shopQuery}`,
    );
  }

  updateDistributorStatus(id: string, status: string) {
    return this.http.patch<any>(
      `${this.baseURL}/api/distributor/${id}/status`,
      { status },
    );
  }

  updateDistributor(id: string, data: any) {
    return this.http.put(`${this.baseURL}/api/distributor/${id}`, data);
  }

  getItemSuggestion(searchTerm: string) {
    console.log(searchTerm);
    return this.http.get(
      `${this.baseURL}/api/item/item-suggestions?term=${searchTerm}`,
    );
  }

  getDistributorLedger(distributorId: string): Observable<any> {
  return this.http.get(
    `${this.baseURL}/api/distributor-ledger/${distributorId}`
  );
}

  createLedgerEntry(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/distributor-ledger`, payload);
  }
}
