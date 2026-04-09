import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import {environment} from '../../../environments/environment'
import { AuthService } from './auth.service';


@Injectable({
  providedIn: 'root'
})
export class BrandService {
  private readonly cacheTtlMs = 60_000;
  private readonly responseCache = new Map<string, { expiresAt: number; value: any }>();
  private readonly inflightCache = new Map<string, Observable<any>>();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllBrands(params: any = {}): Observable<any> {
    const shopId = this.authService.getShopId();
    const finalParams: any = { ...params };
    if (shopId) {
      finalParams.shop = shopId;
    }
    const cacheKey = `${this.baseURL}|${JSON.stringify(finalParams)}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.value);
    }

    const inflight = this.inflightCache.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const request$ = this.http.get(`${this.baseURL}/api/brands`, { params: finalParams }).pipe(
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

  addBrand(data: any): Observable<any> {
    this.clearCache();
    return this.http.post(`${this.baseURL}/api/brands`, data);
  }

  updateBrand(id: string, data: any): Observable<any> {
    this.clearCache();
    return this.http.put(`${this.baseURL}/api/brands/${id}`, data);
  }

  deleteBrand(id: string): Observable<any> {
    this.clearCache();
    return this.http.delete(`${this.baseURL}/api/brands/${id}`);
  }

  private clearCache(): void {
    this.responseCache.clear();
    this.inflightCache.clear();
  }
}
