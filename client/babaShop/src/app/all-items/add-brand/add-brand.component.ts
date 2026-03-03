import { Component } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrandService } from "app/shared/services/brand.service";
import { Inject } from "@angular/core";
import { AuthService } from "app/shared/services/auth.service";
import { PageEvent } from "@angular/material/paginator";

@Component({
  selector: "add-brand",
  templateUrl: "./add-brand.component.html",
  styleUrls: ["./add-brand.component.css"],
})
export class AddBrandComponent {
  name: string = "";
  description: string = "";
  isLoading = false;
  isEditMode = false;
  brandId: string = "";
  isGlobalSuperAdmin = false;

  brands: any[] = [];
  loadingList = false;
  search = "";
  activeFilter: "all" | "true" | "false" = "all";
  pageSize = 5;
  pageIndex = 0;
  totalItems = 0;

  constructor(
    private brandService: BrandService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    public dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  ngOnInit(): void {
    this.isGlobalSuperAdmin =
      this.authService.getUserRole() === "SUPER_ADMIN" &&
      !this.authService.getShopId();

    if (this.data?.brand) {
      this.startEdit(this.data.brand);
    }

    this.loadBrands();
  }

  loadBrands(): void {
    this.loadingList = true;
    const params: any = {
      limit: this.pageSize,
      skip: this.pageIndex * this.pageSize,
      sort: "-createdAt",
    };
    if (this.search.trim()) {
      params.search = this.search.trim();
    }
    if (this.activeFilter !== "all") {
      params.isActive = this.activeFilter;
    }

    this.brandService.getAllBrands(params).subscribe({
      next: (res: any) => {
        this.brands = res?.data || [];
        this.totalItems = res?.totalItems ?? this.brands.length;
        this.loadingList = false;
      },
      error: () => {
        this.loadingList = false;
        this.snackBar.open("Failed to load brands", "Close", { duration: 2500 });
      },
    });
  }

  onSearchChange(): void {
    this.pageIndex = 0;
    this.loadBrands();
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.loadBrands();
  }

  startEdit(brand: any): void {
    this.isEditMode = true;
    this.brandId = brand?._id;
    this.name = brand?.name || "";
    this.description = brand?.description || "";
  }

  resetForm(): void {
    this.isEditMode = false;
    this.brandId = "";
    this.name = "";
    this.description = "";
  }

  toggleStatus(brand: any): void {
    if (this.isGlobalSuperAdmin) {
      this.snackBar.open("Please select a shop first", "Close", { duration: 2500 });
      return;
    }
    this.brandService
      .updateBrand(brand._id, { isActive: !brand.isActive })
      .subscribe({
        next: () => this.loadBrands(),
        error: (error) => {
          this.snackBar.open(error?.error?.message || "Failed to update status", "Close", {
            duration: 2500,
          });
        },
      });
  }

  deleteBrand(brand: any): void {
    if (this.isGlobalSuperAdmin) {
      this.snackBar.open("Please select a shop first", "Close", { duration: 2500 });
      return;
    }
    const ok = confirm(`Delete brand "${brand?.name}"?`);
    if (!ok) return;
    this.brandService.deleteBrand(brand._id).subscribe({
      next: (res: any) => {
        this.snackBar.open(res?.message || "Brand deleted", "Close", { duration: 2500 });
        this.loadBrands();
      },
      error: (error) => {
        this.snackBar.open(error?.error?.message || "Failed to delete brand", "Close", {
          duration: 2500,
        });
      },
    });
  }

  onSubmit(): void {
    if (this.isGlobalSuperAdmin) {
      this.snackBar.open("Please select a shop first", "Close", { duration: 3000 });
      return;
    }

    if (!this.name.trim()) {
      this.snackBar.open("Brand name is required", "Close", { duration: 3000 });
      return;
    }

    this.isLoading = true;
    const payload = {
      name: this.name.trim(),
      description: this.description?.trim(),
    };
    const req$ = this.isEditMode
      ? this.brandService.updateBrand(this.brandId, payload)
      : this.brandService.addBrand(payload);

    req$.subscribe(
      (res: any) => {
        this.snackBar.open(
          res?.message || (this.isEditMode ? "Brand updated successfully" : "Brand created successfully"),
          "Close",
          { duration: 3000 },
        );
        this.isLoading = false;
        this.resetForm();
        this.pageIndex = 0;
        this.loadBrands();
      },
      (error) => {
        this.snackBar.open(
          error.error?.message || (this.isEditMode ? "Failed to update brand" : "Failed to create brand"),
          "Close",
          { duration: 3000 },
        );
        this.isLoading = false;
      },
    );
  }
}
