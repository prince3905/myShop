import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from '../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class SalesService {

  constructor(private http: HttpClient) { }

  get baseURL(): string {
    return environment.apiBaseURL;
  }
  getCustomerSuggestion(searchTerm: string) {
    return this.http.get(`${this.baseURL}/api/sales/customer-suggestions?term=${searchTerm}`);
  }

  addSales(data) {
    return this.http.post(`${this.baseURL}/api/sales`, data);
  }

  getSales(data:any) {
    let params = new HttpParams();
    Object.keys(data || {}).forEach((key) => {
      const value = data[key];
      if (value === null || value === undefined || value === "") return;
      params = params.set(key, String(value));
    });
    return this.http.get(`${this.baseURL}/api/sales`,{ params: params });
  }

  getSaleById(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/sales/${id}`);
  }

  getSaleReturns(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/sales/${id}/returns`);
  }

  getSaleLedger(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/sales/${id}/ledger`);
  }

  getAllSaleReturns(params?: any): Observable<any> {
    let query = new HttpParams();
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value === null || value === undefined || value === "") return;
      query = query.set(key, String(value));
    });
    return this.http.get(`${this.baseURL}/api/sales/returns`, { params: query });
  }

  getSalesReportOverview(params?: any): Observable<any> {
    let query = new HttpParams();
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value === null || value === undefined || value === "") return;
      query = query.set(key, String(value));
    });
    return this.http.get(`${this.baseURL}/api/sales/reports/overview`, { params: query });
  }

  createSaleReturn(id: string, payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/sales/${id}/returns`, payload);
  }

  collectSalePayment(id: string, payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/sales/${id}/payments`, payload);
  }
}
