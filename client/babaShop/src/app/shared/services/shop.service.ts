import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ShopService {

  private SHOP_KEY = 'selected_shop';

  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllShops() {
    return this.http.get<any>(`${this.baseURL}/api/shops/admin/all`);
  }

  setSelectedShop(shopId: string) {
    localStorage.setItem(this.SHOP_KEY, shopId);
  }

  getSelectedShop() {
    return localStorage.getItem(this.SHOP_KEY);
  }

  clearSelectedShop() {
    localStorage.removeItem(this.SHOP_KEY);
  }
}