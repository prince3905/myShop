import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService, private router: Router) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {

    const authToken = this.authService.getToken();
    const resolvedShopId = this.authService.getShopId();
    const userRole = this.authService.getUserRole();

    let headers: any = {};

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const activeShopId = resolvedShopId;
    console.log("[FLOW][FE][INTERCEPTOR] outgoing", {
      url: request.url,
      hasToken: !!authToken,
      selectedShop: this.authService.getCurrentUser()?.shop || null,
      userShop: this.authService.getCurrentUser()?.shop || null,
      role: userRole,
      activeShopId,
    });

    const isShopAdminListCall = request.url.includes('/api/shops/admin/all');

    if (activeShopId && !isShopAdminListCall) {
      headers['x-shop-id'] = activeShopId;
    }

    const modifiedRequest = request.clone({
      setHeaders: headers,
    });

    return next.handle(modifiedRequest).pipe(
      catchError((err: HttpErrorResponse) => {
        const isLoginCall = request.url.includes('/api/auth/login');

        if (err.status === 401 && !isLoginCall) {
          if (authToken) {
            this.authService.removeToken();
            this.authService.removeUser();
          }
          if (this.router.url !== '/login') {
            this.router.navigateByUrl('/login');
          }
        }
        return throwError(() => err);
      })
    );
  }
}
