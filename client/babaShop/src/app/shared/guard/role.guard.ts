import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const expectedRoles: string[] = route.data['roles'] || [];
    if (expectedRoles.length === 0) {
      return true;
    }

    const userRole = this.authService.getUserRole();
    if (userRole && expectedRoles.includes(userRole)) {
      return true;
    }

    this.router.navigate(['/dashboard']);
    return false;
  }
}
