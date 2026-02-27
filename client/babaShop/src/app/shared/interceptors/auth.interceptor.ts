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
    const selectedShop = localStorage.getItem('selected_shop');
    const userShop = this.authService.getShopId();

    let headers: any = {};

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const activeShopId = selectedShop || userShop;

    if (activeShopId) {
      headers['x-shop-id'] = activeShopId;
    }

    const modifiedRequest = request.clone({
      setHeaders: headers,
    });

    return next.handle(modifiedRequest).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.authService.removeToken();
          this.authService.removeUser();
          this.router.navigateByUrl('/authentication/login');
        }
        return throwError(() => err);
      })
    );
  }
}
