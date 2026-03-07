import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private router: Router,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const expectedRoles: string[] = route.data['roles'] || [];
    if (expectedRoles.length === 0) {
      return true;
    }

    const userRole = this.authService.getUserRole();
    if (userRole && expectedRoles.includes(userRole)) {
      const requireShop = Boolean(route.data['requireShop']);
      const allowGlobalRead = Boolean(route.data['allowGlobalRead']);
      const isSuperAdminGlobal = userRole === 'SUPER_ADMIN' && !this.authService.getShopId();
      if (requireShop && !this.authService.getShopId() && !(allowGlobalRead && isSuperAdminGlobal)) {
        const message = isSuperAdminGlobal
          ? 'Global mode read-only hai. Action ya shop-scoped screen ke liye pehle shop select karo.'
          : 'Aapka access shop-wise hai. Is screen ke liye valid shop context required hai.';
        this.snackBar.open(message, 'Close', {
          duration: 3000,
        });
        this.router.navigate(['/dashboard']);
        return false;
      }

      return true;
    }

    this.snackBar.open(this.authService.getRoleAccessMessage(expectedRoles), 'Close', {
      duration: 3200,
    });
    this.router.navigate(['/dashboard']);
    return false;
  }
}
