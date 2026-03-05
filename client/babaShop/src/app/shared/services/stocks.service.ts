import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from '../../../environments/environment'


@Injectable({
  providedIn: 'root'
})
export class StocksService {

  constructor(private http: HttpClient) { }

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getStocks(data: any) {
    let params = new HttpParams();
    Object.keys(data || {}).forEach((key) => {
      const value = data[key];
      if (value === null || value === undefined || value === "") return;
      params = params.set(key, String(value));
    });
    return this.http.get(`${this.baseURL}/api/stocks`, { params });
  }

  getTransactions(data: any) {
    let params = new HttpParams();
    Object.keys(data || {}).forEach((key) => {
      const value = data[key];
      if (value === null || value === undefined || value === "") return;
      params = params.set(key, String(value));
    });
    return this.http.get(`${this.baseURL}/api/stocks/transactions`, { params });
  }

  manualAdjust(payload: any) {
    return this.http.post(`${this.baseURL}/api/stocks/adjust`, payload);
  }
}
