import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from '../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class OrderService {

  constructor(private http: HttpClient) { }

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  listOrders(data: any = {}): Observable<any> {
    const params = new HttpParams({ fromObject: data || {} });
    return this.http.get(`${this.baseURL}/api/order`, { params });
  }

  getAllOrder(data: any = {}): Observable<any> {
    return this.listOrders(data);
  }

  getOrderById(id: string): Observable<any> {
    return this.http.get(`${this.baseURL}/api/order/${id}`);
  }

  createOrder(payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/order`, payload);
  }

  updateOrder(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.baseURL}/api/order/${id}`, payload);
  }

  collectOrderPayment(id: string, payload: any): Observable<any> {
    return this.http.post(`${this.baseURL}/api/order/${id}/collect-payment`, payload);
  }

  updateOrderStatus(id: string, payload: any): Observable<any> {
    return this.http.patch(`${this.baseURL}/api/order/${id}/status`, payload);
  }

}
