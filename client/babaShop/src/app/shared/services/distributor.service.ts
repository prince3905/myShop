import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";


@Injectable({
  providedIn: 'root'
})
export class DistributorService {

  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getDistributor(data: any) {
    const params = new HttpParams({ fromObject: data });
    // console.log(params);
    return this.http.get(`${this.baseURL}/api/distributor`, { params: params });
  }

  AddDistributor(data: any) {
    return this.http.post(`${this.baseURL}/api/distributor`, data);
  }
  

}
