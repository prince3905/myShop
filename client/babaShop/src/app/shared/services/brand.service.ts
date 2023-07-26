import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from '../../../environments/environment'


@Injectable({
  providedIn: 'root'
})
export class BrandService {

  constructor(private http: HttpClient) { }

  get baseURL(): string {
    return environment.apiBaseURL;
  }

    getBrand() {
    return this.http.get(`${this.baseURL}/api/brand`);
  }

}
