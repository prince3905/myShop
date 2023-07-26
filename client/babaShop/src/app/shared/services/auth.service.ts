// auth.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, catchError, finalize } from 'rxjs/operators';
import {environment} from '../../../environments/environment'
import { BehaviorSubject, throwError } from 'rxjs';

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
  providedIn: 'root'
})
export class AuthService {
  public showLoader: boolean = false;
  private TOKEN_KEY: string = 'token';
  private USER_KEY: string = 'user';
 
  constructor(private http: HttpClient) {}

  get baseURL(): string {
    return environment.apiBaseURL;
  }

  private saveToken(token:any) {
    localStorage.setItem(this.TOKEN_KEY, token)
  }

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY)
  }

  removeToken() {
    return localStorage.removeItem(this.TOKEN_KEY)
  }

  removeUser() {
    return localStorage.removeItem(this.USER_KEY)
  }

  set user(user) {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  get user() {
   const user = localStorage.getItem(this.USER_KEY);
   return user ? JSON.parse(user) : {};
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
        tap(({ token, user }) => {
          this.saveToken(token);
          this.user = user;
          // this.loggedin$.next(true);
        }),
        catchError((err) => {
          if (!err.status || err.status === 500) {
            return throwError({
              ...err,
              error: {
                message: 'Something went wrong',
                success: false,
              },
            });
          }

          return throwError(err);
        })
      );
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
        })
      );
  }

  logout() {
    return this.http.get<any>(`${this.baseURL}/api/auth/logout`).pipe(
      finalize(() => {
        this.removeToken();
        this.removeUser();
      })
    );
  }

  isLoggedIn(): boolean {
    const user = localStorage.getItem('user');
    return user ? true : false;
  }
 
}