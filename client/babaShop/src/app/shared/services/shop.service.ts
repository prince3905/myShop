import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ShopService {

  private selectedShopSubject = new BehaviorSubject<string | null>(
    null,
  );
  selectedShop$ = this.selectedShopSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) {
    this.selectedShopSubject.next(this.authService.getShopId());
    this.authService.currentShop$.subscribe((shopId) => {
      this.selectedShopSubject.next(shopId);
    });
  }

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllShops() {
    return this.http.get<any>(`${this.baseURL}/api/shops/admin/all`);
  }

  getPushTargetShops() {
    return this.http.get<any>(`${this.baseURL}/api/shops/push-targets`);
  }

  getShopById(id: string) {
    return this.http.get<any>(`${this.baseURL}/api/shops/${id}`);
  }

  createShop(payload: any) {
    return this.http.post<any>(`${this.baseURL}/api/shops`, payload);
  }

  setSelectedShop(shopId: string, shopCode: string | null = null) {
    if (!shopId) {
      this.clearSelectedShop();
      return;
    }

    this.authService.setActiveShop(shopId, shopCode);
    this.selectedShopSubject.next(shopId);
  }

  getSelectedShop() {
    return this.authService.getShopId();
  }

  clearSelectedShop() {
    this.authService.setActiveShop(null);
    this.selectedShopSubject.next(null);
  }
}
