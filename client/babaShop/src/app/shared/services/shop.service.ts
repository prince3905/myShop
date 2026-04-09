import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ShopService {
  private readonly cacheTtlMs = 60_000;
  private readonly responseCache = new Map<string, { expiresAt: number; value: any }>();
  private readonly inflightCache = new Map<string, Observable<any>>();

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
    const cacheKey = `${this.baseURL}|admin/all`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.value);
    }

    const inflight = this.inflightCache.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const request$ = this.http.get<any>(`${this.baseURL}/api/shops/admin/all`).pipe(
      tap((response) => {
        this.responseCache.set(cacheKey, {
          expiresAt: Date.now() + this.cacheTtlMs,
          value: response,
        });
        this.inflightCache.delete(cacheKey);
      }),
      catchError((error) => {
        this.inflightCache.delete(cacheKey);
        return throwError(() => error);
      }),
      shareReplay(1),
    );

    this.inflightCache.set(cacheKey, request$);
    return request$;
  }

  getPushTargetShops() {
    return this.http.get<any>(`${this.baseURL}/api/shops/push-targets`);
  }

  getShopById(id: string) {
    return this.http.get<any>(`${this.baseURL}/api/shops/${id}`);
  }

  createShop(payload: any) {
    this.clearCache();
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

  private clearCache(): void {
    this.responseCache.clear();
    this.inflightCache.clear();
  }
}
