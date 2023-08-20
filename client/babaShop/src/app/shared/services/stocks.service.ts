import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import {environment} from '../../../environments/environment'


@Injectable({
  providedIn: 'root'
})
export class StocksService {

  constructor(private http: HttpClient) { }

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getStocks(data: any) {
    const params = new HttpParams({ fromObject: data });
    return this.http.get(`${this.baseURL}/api/stock`,{ params: params });
  }
}
