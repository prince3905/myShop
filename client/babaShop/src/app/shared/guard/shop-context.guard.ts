import { Injectable } from "@angular/core";
import { CanActivate, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

@Injectable({
  providedIn: "root",
})
export class ShopContextGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(): boolean {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(["/login"]);
      return false;
    }

    const role = this.authService.getUserRole();
    if (role === "SUPER_ADMIN") {
      return true;
    }

    const shopId = this.authService.getShopId();
    if (!shopId) {
      this.authService.removeToken();
      this.authService.removeUser();
      this.router.navigate(["/login"]);
      return false;
    }

    return true;
  }
}
