import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";


@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getCustomer(data: any) {
    const params = new HttpParams({ fromObject: data });
    return this.http.get(`${this.baseURL}/api/customer`, { params: params });
  }

  searchCustomers(searchTerm: string) {
    return this.http.get(`${this.baseURL}/api/customer/search`, {
      params: { q: searchTerm, limit: '20' }
    });
  }

  getCustomerById(id: string) {
    return this.http.get(`${this.baseURL}/api/customer/${id}`);
  }

  getCustomerSales(id: string, params?: any) {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
          httpParams = httpParams.set(key, String(params[key]));
        }
      });
    }
    return this.http.get(`${this.baseURL}/api/customer/${id}/sales`, { params: httpParams });
  }

  createCustomer(customerData: any) {
    return this.http.post(`${this.baseURL}/api/customer`, customerData);
  }

  updateCustomer(id: string, customerData: any) {
    return this.http.put(`${this.baseURL}/api/customer/${id}`, customerData);
  }
}
