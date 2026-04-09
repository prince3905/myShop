import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of, throwError } from "rxjs";
import { catchError, shareReplay, tap } from "rxjs/operators";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class VariationService {
  private readonly cacheTtlMs = 30_000;
  private readonly responseCache = new Map<string, { expiresAt: number; value: any }>();
  private readonly inflightCache = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getVariations(params: any = {}): Observable<any> {
    const httpParams = new HttpParams({ fromObject: params });
    const cacheKey = `${this.baseURL}|variations:${httpParams.toString()}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.value);
    }

    const inflight = this.inflightCache.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const request$ = this.http.get(`${this.baseURL}/api/product-variations`, {
      params: httpParams,
    }).pipe(
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

  getVariationById(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/product-variations/${id}`);
  }

  getVariationUsage(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/product-variations/${id}/usage`);
  }

  createVariation(payload: any): Observable<any> {
    this.clearCache();
    return this.http.post(`${this.baseURL}/api/product-variations`, payload);
  }

  updateVariation(id: string, payload: any): Observable<any> {
    this.clearCache();
    return this.http.put(`${this.baseURL}/api/product-variations/${id}`, payload);
  }

  deleteVariation(id: string): Observable<any> {
    this.clearCache();
    return this.http.delete(`${this.baseURL}/api/product-variations/${id}`);
  }

  logLabelPrint(id: string, payload: { quantity: number; size: string }): Observable<any> {
    return this.http.post(`${this.baseURL}/api/product-variations/${id}/print-log`, payload);
  }

  private clearCache(): void {
    this.responseCache.clear();
    this.inflightCache.clear();
  }
}
