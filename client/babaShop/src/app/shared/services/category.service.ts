import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from '../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class CategoryService {

  constructor(private http: HttpClient) { }

   get baseURL(): string {
    return environment.apiBaseURL;
  }

    getCategory() {
    return this.http.get(`${this.baseURL}/api/category`);
  }

  addCategory(data) {
    return this.http.post(`${this.baseURL}/api/category`, data);
  }
  getCategoryOnBrands(Id:any){
    return this.http.get(`${this.baseURL}/api/category/${Id}/brands`)
  }

   getCategorySuggestion(searchTerm: string) {
    console.log(searchTerm);
    return this.http.get(`${this.baseURL}/api/category/category-suggestions?term=${searchTerm}`);
   }

   updateOrCreateCategory(categoryData: any): Observable<any> {
    const url = `${this.baseURL}/api/category`;
    return this.http.put(url, categoryData);
  }

}
