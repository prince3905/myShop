import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ProductModelService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getModels(): Observable<any> {
    return this.http.get(`${this.baseURL}/api/product-models`);
  }

  createModel(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/product-models`, payload);
  }
}
