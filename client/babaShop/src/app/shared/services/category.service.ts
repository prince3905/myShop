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
}
