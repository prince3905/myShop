// auth.service.ts

import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { tap, catchError, finalize } from "rxjs/operators";
import { environment } from "../../../environments/environment";
import { BehaviorSubject, throwError } from "rxjs";

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: any;
}

interface AuthenticatedResponse {
  success: boolean;
  user: any;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  public showLoader: boolean = false;
  private TOKEN_KEY: string = "token";
  private USER_KEY: string = "user";

  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

 private saveToken(token: string) {
  localStorage.setItem(this.TOKEN_KEY, token);
}

isLoggedIn(): boolean {
  return !!this.getToken();
}

login(email: string, password: string) {
  this.showLoader = true;

  return this.http
    .post<LoginResponse>(`${this.baseURL}/api/auth/login`, {
      email,
      password,
    })
    .pipe(
      finalize(() => {
        this.showLoader = false;
      }),
      tap((res) => {
        if (res.success && res.token && res.user) {
          this.saveToken(res.token);
          this.user = res.user;
        }
      })
    );
}

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  removeToken() {
    return localStorage.removeItem(this.TOKEN_KEY);
  }

  removeUser() {
    return localStorage.removeItem(this.USER_KEY);
  }

  set user(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }


 getUserRole(): string | null {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user).role : null;
}

  

  authenticated() {
    // this.showLoader = true;
    return this.http
      .get<AuthenticatedResponse>(`${this.baseURL}/api/auth/authenticated`)
      .pipe(
        finalize(() => {
          this.showLoader = false;
        }),
        tap(({ user }) => {
          this.user = user;
        }),
        catchError((err) => {
          return throwError(err);
        }),
      );
  }

  logout() {
    return this.http.get<any>(`${this.baseURL}/api/auth/logout`).pipe(
      finalize(() => {
        this.removeToken();
        this.removeUser();
      }),
    );
  }

  isSuperAdmin(): boolean {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  console.log('User role:', user.role); // Debugging log
  return user.role === 'SUPER_ADMIN';
}

  
}
