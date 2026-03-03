import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { AuthService } from "app/shared/services/auth.service";
import { ShopService } from "app/shared/services/shop.service";

@Component({
  selector: "app-manage-shops",
  templateUrl: "./manage-shops.component.html",
  styleUrls: ["./manage-shops.component.css"],
})
export class ManageShopsComponent implements OnInit {
  shops: any[] = [];
  loading = false;
  saving = false;
  shopForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private shopService: ShopService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {
    this.shopForm = this.fb.group({
      name: ["", [Validators.required, Validators.minLength(2)]],
      shopCode: ["", [Validators.required, Validators.minLength(3)]],
      contactNumber: [""],
      email: ["", Validators.email],
      shopType: ["HYBRID"],
    });
  }

  ngOnInit(): void {
    if (!this.authService.isSuperAdmin()) {
      this.snackBar.open("Only super admin can manage shops", "Close", { duration: 3000 });
      this.router.navigateByUrl("/dashboard");
      return;
    }
    this.loadShops();
  }

  loadShops(): void {
    this.loading = true;
    this.shopService.getAllShops().subscribe({
      next: (res: any) => {
        this.shops = Array.isArray(res?.data) ? res.data : [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open("Failed to load shops", "Close", { duration: 3000 });
      },
    });
  }

  createShop(): void {
    if (this.shopForm.invalid || this.saving) {
      this.shopForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const payload = {
      ...this.shopForm.value,
      shopCode: (this.shopForm.value.shopCode || "").toUpperCase(),
    };

    this.shopService.createShop(payload).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.snackBar.open(res?.message || "Shop created successfully", "Close", { duration: 2500 });
        this.shopForm.reset({ shopType: "HYBRID" });
        this.loadShops();
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(err?.error?.message || "Failed to create shop", "Close", { duration: 3000 });
      },
    });
  }

  switchShop(shop: any): void {
    this.shopService.setSelectedShop(shop?._id, shop?.shopCode || null);
    this.snackBar.open(`Switched to ${shop?.name || "shop"}`, "Close", { duration: 2000 });
    window.location.reload();
  }
}
