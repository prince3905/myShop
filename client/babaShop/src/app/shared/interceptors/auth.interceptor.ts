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

    const modifiedRequest = authToken
      ? request.clone({
          setHeaders: {
            Authorization: `Bearer ${authToken}`,
          },
        })
      : request;

    return next.handle(modifiedRequest).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401) {
          this.authService.removeToken();
          this.authService.removeUser();
          this.router.navigateByUrl('/authentication/login/simple');
        }
        return throwError(err);
      })
    );
  }
}
