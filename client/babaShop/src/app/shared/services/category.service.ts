import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class CategoryService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllCategories(): Observable<any> {
    const shopId = localStorage.getItem("selected_shop");
    return this.http.get(`${this.baseURL}/api/categories`, {
      params: { shop: shopId || "" },
    });
  }

  addCategory(data: any): Observable<any> {
    const shopId = localStorage.getItem("selected_shop");
    return this.http.post(`${this.baseURL}/api/categories`, {
      ...data,
      shop: shopId,
    });
  }

  updateCategory(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/categories/${id}`, data);
  }

  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/categories/${id}`);
  }
}
