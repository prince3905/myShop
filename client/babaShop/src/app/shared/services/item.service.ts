import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {environment} from '../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class ItemService {

  constructor(private http: HttpClient) { }

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getItem() {
    return this.http.get(`${this.baseURL}/api/item`);
  }

  getItemDetails(id: string) {
    return this.http.get(`${this.baseURL}/api/item/${id}`);
  }

  addItem(data) {
    return this.http.post(`${this.baseURL}/api/item`, data);
  }

  updateItem(data) {
    return this.http.put(`${this.baseURL}/api/item`, data);
  }

    deleteItem(itemId: string) {
    return this.http.delete(`${this.baseURL}/api/item/${itemId}`);
  }


}
