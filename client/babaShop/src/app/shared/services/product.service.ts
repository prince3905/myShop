import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of, throwError } from "rxjs";
import { catchError, shareReplay, tap } from "rxjs/operators";
import { environment } from "../../../environments/environment";
import { AuthService } from "./auth.service";

@Injectable({
  providedIn: "root",
})
export class ProductService {
  private readonly cacheTtlMs = 30_000;
  private readonly responseCache = new Map<string, { expiresAt: number; value: any }>();
  private readonly inflightCache = new Map<string, Observable<any>>();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllProducts(query: Record<string, any> = {}): Observable<any> {
    const shopId = this.authService.getShopId();
    let params = new HttpParams().set("shop", shopId || "");

    Object.keys(query || {}).forEach((key) => {
      const value = query[key];
      if (value === null || value === undefined || value === "") return;
      params = params.set(key, String(value));
    });

    const cacheKey = `${this.baseURL}|${params.toString()}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.value);
    }

    const inflight = this.inflightCache.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const request$ = this.http.get(`${this.baseURL}/api/products`, { params }).pipe(
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

  getProductById(id: string): Observable<any> {
    const cacheKey = `${this.baseURL}|product:${id}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.value);
    }

    const inflight = this.inflightCache.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const request$ = this.http.get(`${this.baseURL}/api/products/${id}`).pipe(
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

  addProduct(data: any): Observable<any> {
    this.clearCache();
    return this.http.post(`${this.baseURL}/api/products`, data);
  }

  updateProduct(id: string, data: any): Observable<any> {
    this.clearCache();
    return this.http.put(`${this.baseURL}/api/products/${id}`, data);
  }

  deleteProduct(id: string): Observable<any> {
    this.clearCache();
    return this.http.delete(`${this.baseURL}/api/products/${id}`);
  }

  private clearCache(): void {
    this.responseCache.clear();
    this.inflightCache.clear();
  }
}
