import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class UserService {
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  getUsers() {
    return this.http.get<any>(`${this.baseURL}/api/users`);
  }

  createUser(payload: any) {
    return this.http.post<any>(`${this.baseURL}/api/users`, payload);
  }

  updateUser(userId: string, payload: any) {
    return this.http.put<any>(`${this.baseURL}/api/users/${userId}`, payload);
  }
}
