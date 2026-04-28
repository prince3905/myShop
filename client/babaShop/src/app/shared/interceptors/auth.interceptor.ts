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
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private lastShopWarningAt = 0;
  private lastErrorToastAt = 0;
  private lastErrorToastMessage = '';
  private readonly shopScopedPrefixes = [
    '/api/distributor',
    '/api/distributor-ledger',
    '/api/products',
    '/api/product-models',
    '/api/product-variations',
    '/api/stocks',
    '/api/purchases',
    '/api/purchase',
    '/api/sales',
    '/api/customer',
    '/api/order',
    '/api/orders',
  ];

  private readonly readOnlyMethods = ['GET', 'HEAD', 'OPTIONS'];

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  private requiresShopContext(url: string): boolean {
    return this.shopScopedPrefixes.some((prefix) => url.includes(prefix));
  }

  private showShopRequiredWarning(): void {
    const now = Date.now();
    if (now - this.lastShopWarningAt < 1500) {
      return;
    }

    this.lastShopWarningAt = now;
    this.snackBar.open('Global mode is read-only. Please select a shop to make changes.', 'Close', {
      duration: 3000,
    });
  }

  private showFriendlyError(message: string): void {
    const now = Date.now();
    const normalized = `${message || ''}`.trim();
    if (!normalized) {
      return;
    }
    if (this.lastErrorToastMessage === normalized && now - this.lastErrorToastAt < 1500) {
      return;
    }

    this.lastErrorToastMessage = normalized;
    this.lastErrorToastAt = now;
    this.snackBar.open(normalized, 'Close', { duration: 3200 });
  }

  private extractFriendlyMessage(err: HttpErrorResponse): string {
    const backendMessage =
      err?.error?.message ||
      err?.error?.error ||
      (typeof err?.error === 'string' ? err.error : '') ||
      '';

    if (backendMessage) {
      if (backendMessage.includes('Please select a shop first')) {
        return 'Global mode is read-only. Please select a shop to continue.';
      }
      if (backendMessage.includes('read-only')) {
        return backendMessage;
      }
      if (backendMessage.includes('phone') || backendMessage.includes('Phone')) {
        return 'Invalid phone number. Use 10 digit number.';
      }
      return backendMessage;
    }

    if (err.status === 0) {
      return 'Server se connection nahi ho pa raha. Please check backend/server.';
    }
    if (err.status === 400) {
      return 'Request valid nahi thi. Please entered data check karke dobara try karo.';
    }
    if (err.status === 401) {
      return 'Session expire ho gaya. Please login again.';
    }
    if (err.status === 403) {
      return 'Aapko is action ki permission nahi hai.';
    }
    if (err.status === 404) {
      return 'Requested record nahi mila.';
    }
    if (err.status === 409) {
      return 'Same data already exists. Duplicate entry allowed nahi hai.';
    }
    if (err.status === 429) {
      return 'Bahut zyada requests ho gayi. Thodi der baad try karo.';
    }
    if (err.status >= 500) {
      return 'Server side problem aayi hai. Please thodi der baad dobara try karo.';
    }

    return 'Something went wrong. Please try again.';
  }

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
    const isShopAdminListCall = request.url.includes('/api/shops/admin/all');
    const isShopRequiredRequest = this.requiresShopContext(request.url);
    const isSuperAdminWithoutShop = userRole === 'SUPER_ADMIN' && !activeShopId;
    const isReadOnlyRequest = this.readOnlyMethods.includes((request.method || '').toUpperCase());

    if (isSuperAdminWithoutShop && isShopRequiredRequest && !isShopAdminListCall && !isReadOnlyRequest) {
      this.showShopRequiredWarning();
      if (this.router.url !== '/dashboard') {
        this.router.navigate(['/dashboard']);
      }

      return throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            statusText: 'Shop Required',
              url: request.url,
              error: {
                success: false,
                message: 'Global mode is read-only. Please select a shop to continue.',
              },
            }),
      );
    }

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
          this.showFriendlyError(this.extractFriendlyMessage(err));
          if (authToken) {
            this.authService.removeToken();
            this.authService.removeUser();
          }
          if (this.router.url !== '/login') {
            this.router.navigateByUrl('/login');
          }
          return throwError(() => err);
        }

        if (!isLoginCall) {
          this.showFriendlyError(this.extractFriendlyMessage(err));
        }
        return throwError(() => err);
      })
    );
  }
}
