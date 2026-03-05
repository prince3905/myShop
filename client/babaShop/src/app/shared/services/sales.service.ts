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
    return this.http.get(`${this.baseURL}/api/purchase/customer-suggestions?term=${searchTerm}`);
  }

  addSales(data) {
    return this.http.post(`${this.baseURL}/api/purchase`, data);
  }

  getSales(data:any) {
    let params = new HttpParams();
    Object.keys(data || {}).forEach((key) => {
      const value = data[key];
      if (value === null || value === undefined || value === "") return;
      params = params.set(key, String(value));
    });
    return this.http.get(`${this.baseURL}/api/purchase`,{ params: params });
  }
}
