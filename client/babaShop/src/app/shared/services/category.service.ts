import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import { AuthService } from "./auth.service";

@Injectable({
  providedIn: "root",
})
export class CategoryService {
  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllCategories(params: any = {}): Observable<any> {
    const shopId = this.authService.getShopId();
    const finalParams: any = { ...params };

    if (shopId) {
      finalParams.shop = shopId;
    }

    return this.http.get(`${this.baseURL}/api/categories`, { params: finalParams });
  }

  addCategory(data: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/categories`, data);
  }

  updateCategory(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/categories/${id}`, data);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/categories/${id}`);
  }
}
