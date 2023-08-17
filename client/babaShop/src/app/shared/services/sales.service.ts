import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import {environment} from '../../../environments/environment'

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private mockData = [
    { id: 1, name: 'Anddi' },
    { id: 2, name: 'Bandi' },
    { id: 3, name: 'Sandi' },
    { id: 4, name: 'Manjuri ki bb' },
    { id: 5, name: 'randi chodi' },
  ];

  searchItems(searchTerm: string): Observable<any[]> {
    const filteredItems = this.mockData.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return of(filteredItems);
  }

  constructor(private http: HttpClient) { }

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  addSales(data) {
    return this.http.post(`${this.baseURL}/api/purchase`, data);
  }

  getSales(data:any) {
    const params = new HttpParams({ fromObject: data });
    // console.log(params)
    return this.http.get(`${this.baseURL}/api/purchase`,{ params: params });
  }
}
