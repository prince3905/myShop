import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
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
    console.log(searchTerm);
    return this.http.get(`${this.baseURL}/api/purchase/customer-suggestions?term=${searchTerm}`);
  }

  addSales(data) {
    return this.http.post(`${this.baseURL}/api/purchase`, data);
  }

  getSales(data:any) {
    const params = new HttpParams({ fromObject: data });
    // console.log(params)
    return this.http.get(`${this.baseURL}/api/purchase`,{ params: params });
  }
}
