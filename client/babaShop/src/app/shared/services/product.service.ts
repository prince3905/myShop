import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ProductService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllProducts(): Observable<any> {
    const shopId = localStorage.getItem("selected_shop");
    if (!shopId) {
      throw new Error("Shop ID not found please Chose a shop first");
    }
    return this.http.get(`${this.baseURL}/api/products`, {
      params: { shop: shopId || "" },
    });
  }

  getProductById(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/products/${id}`);
  }

  addProduct(data: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/products`, data);
  }

  updateProduct(id: string, data: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/products/${id}`, data);
  }

  deleteProduct(id: string): Observable<any> {
    return this.http.delete(`${this.baseURL}/api/products/${id}`);
  }
}
