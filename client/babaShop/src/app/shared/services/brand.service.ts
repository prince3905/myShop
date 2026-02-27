import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from '../../../environments/environment'
import { AuthService } from './auth.service';


@Injectable({
  providedIn: 'root'
})
export class BrandService {

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllBrands(): Observable<any> {
    const shopId = this.authService.getShopId();
    return this.http.get(`${this.baseURL}/api/brands`, {
      params: { shop: shopId || "" }
    });
  }

  addBrand(data: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/brands`, data);
  }

  updateBrand(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/brands/${id}`, data);
  }

  deleteBrand(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/brands/${id}`);
  }
}
