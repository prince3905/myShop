import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of, throwError } from "rxjs";
import { catchError, shareReplay, tap } from "rxjs/operators";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ProductModelService {
  private readonly cacheTtlMs = 60_000;
  private readonly responseCache = new Map<string, { expiresAt: number; value: any }>();
  private readonly inflightCache = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getModels(query: Record<string, any> = {}): Observable<any> {
    let params = new HttpParams();
    Object.keys(query || {}).forEach((key) => {
      const value = query[key];
      if (value === null || value === undefined || value === "") return;
      params = params.set(key, String(value));
    });

    const cacheKey = `${this.baseURL}|models:${params.toString()}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.value);
    }

    const inflight = this.inflightCache.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const request$ = this.http.get(`${this.baseURL}/api/product-models`, { params }).pipe(
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

  createModel(payload: any): Observable<any> {
    this.responseCache.clear();
    this.inflightCache.clear();
    return this.http.post(`${this.baseURL}/api/product-models`, payload);
  }

  updateModel(id: string, payload: any): Observable<any> {
    this.responseCache.clear();
    this.inflightCache.clear();
    return this.http.put(`${this.baseURL}/api/product-models/${id}`, payload);
  }

  deleteModel(id: string): Observable<any> {
    this.responseCache.clear();
    this.inflightCache.clear();
    return this.http.delete(`${this.baseURL}/api/product-models/${id}`);
  }
}
