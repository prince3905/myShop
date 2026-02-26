import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from '../../../environments/environment'


@Injectable({
  providedIn: 'root'
})
export class BrandService {

  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllBrands(): Observable<any> {
    const shopId = localStorage.getItem("selected_shop");
    return this.http.get(`${this.baseURL}/api/brands`, {
      params: { shop: shopId || "" }
    });
  }

  addBrand(data: any): Observable<any> {
    const shopId = localStorage.getItem("selected_shop");
    return this.http.post(`${this.baseURL}/api/brands`, {
      ...data,
      shop: shopId
    });
  }

  updateBrand(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/brands/${id}`, data);
  }

  deleteBrand(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/brands/${id}`);
  }
}
