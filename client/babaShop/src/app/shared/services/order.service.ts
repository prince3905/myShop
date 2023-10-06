import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import {environment} from '../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  constructor(private http: HttpClient) { }

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getAllOrder(data:any) {
    const params = new HttpParams({ fromObject: data });
    // console.log(params)
    return this.http.get(`${this.baseURL}/api/order`,{ params: params });
  }

}