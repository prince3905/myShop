import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";


@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getCustomer(data: any) {
    const params = new HttpParams({ fromObject: data });
    // console.log(params);
    return this.http.get(`${this.baseURL}/api/customer`, { params: params });
  }
}
