import { Component } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { CategoryService } from "app/shared/services/category.service";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Inject } from "@angular/core";
import { AuthService } from "app/shared/services/auth.service";
import { PageEvent } from "@angular/material/paginator";
import { BrandService } from "app/shared/services/brand.service";

@Component({
  selector: "add-category",
  templateUrl: "./add-category.component.html",
  styleUrls: ["./add-category.component.css"],
})
export class AddCategoryComponent {
  name: string = "";
  description: string = "";
  isLoading = false;
  isEditMode = false;
  categoryId: string = "";
  isGlobalSuperAdmin = false;
  generating = false;

  categories: any[] = [];
  loadingList = false;
  search = "";
  activeFilter: "all" | "true" | "false" = "all";
  pageSize = 5;
  pageIndex = 0;
  totalItems = 0;
  allBrands: any[] = [];
  selectedBrands: string[] = [];

  constructor(
    private categoryService: CategoryService,
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

    if (this.data?.category) {
      this.startEdit(this.data.category);
    }

    this.loadCategories();
    this.loadBrands();
  }

  generateDescription(): void {
    if (!this.name?.trim()) {
      this.snackBar.open("Please enter category name first", "Close", { duration: 2500 });
      return;
    }

    this.generating = true;
    const adj = ["wide range of", "premium", "quality", "durable", "popular"];
    const randomAdj = adj[Math.floor(Math.random() * adj.length)];
    const generated = randomAdj.charAt(0).toUpperCase() + randomAdj.slice(1) + " " + this.name.trim() + " collection for every need. Browse our best selection.";
    
    if (this.description) {
      this.description = this.description + " " + generated;
    } else {
      this.description = generated;
    }
    this.generating = false;
    this.snackBar.open("Description added", "Close", { duration: 2000 });
  }

  loadBrands(): void {
    this.brandService.getAllBrands({ limit: 500 }).subscribe({
      next: (res: any) => {
        this.allBrands = res?.data || [];
      },
      error: () => {
        this.snackBar.open("Failed to load brands", "Close", { duration: 2500 });
      },
    });
  }

  loadCategories(): void {
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

    this.categoryService.getAllCategories(params).subscribe({
      next: (res: any) => {
        this.categories = res?.data || [];
        this.totalItems = res?.totalItems ?? this.categories.length;
        this.loadingList = false;
      },
      error: () => {
        this.loadingList = false;
        this.snackBar.open("Failed to load categories", "Close", { duration: 2500 });
      },
    });
  }

  onSearchChange(): void {
    this.pageIndex = 0;
    this.loadCategories();
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.loadCategories();
  }

  startEdit(category: any): void {
    this.isEditMode = true;
    this.categoryId = category?._id;
    this.name = category?.name || "";
    this.description = category?.description || "";
    this.selectedBrands = Array.isArray(category?.brands)
      ? category.brands.map((brand: any) => (typeof brand === "string" ? brand : `${brand?._id || ""}`))
      : [];
  }

  resetForm(): void {
    this.isEditMode = false;
    this.categoryId = "";
    this.name = "";
    this.description = "";
    this.selectedBrands = [];
  }

  toggleStatus(category: any): void {
    if (this.isGlobalSuperAdmin) {
      this.snackBar.open("Please select a shop first", "Close", { duration: 2500 });
      return;
    }
    this.categoryService
      .updateCategory(category._id, { isActive: !category.isActive })
      .subscribe({
        next: () => this.loadCategories(),
        error: (error) => {
          this.snackBar.open(error?.error?.message || "Failed to update status", "Close", {
            duration: 2500,
          });
        },
      });
  }

  deleteCategory(category: any): void {
    if (this.isGlobalSuperAdmin) {
      this.snackBar.open("Please select a shop first", "Close", { duration: 2500 });
      return;
    }
    const ok = confirm(`Delete category "${category?.name}"?`);
    if (!ok) return;
    this.categoryService.deleteCategory(category._id).subscribe({
      next: (res: any) => {
        this.snackBar.open(res?.message || "Category deleted", "Close", { duration: 2500 });
        this.loadCategories();
      },
      error: (error) => {
        this.snackBar.open(error?.error?.message || "Failed to delete category", "Close", {
          duration: 2500,
        });
      },
    });
  }

  onSubmit(): void {
    if (this.isGlobalSuperAdmin) {
      this.snackBar.open("Please select a shop first", "Close", {
        duration: 3000,
        panelClass: ["snackbar-error"],
      });
      return;
    }

    if (!this.name.trim()) {
      this.snackBar.open("Category name is required", "Close", {
        duration: 3000,
        panelClass: ["snackbar-error"],
      });
      return;
    }

    this.isLoading = true;

    const payload = {
      name: this.name.trim(),
      description: this.description?.trim(),
      brands: this.selectedBrands,
    };

    const req$ = this.isEditMode
      ? this.categoryService.updateCategory(this.categoryId, payload)
      : this.categoryService.addCategory(payload);

    req$.subscribe({
      next: (res: any) => {
        this.snackBar.open(
          res?.message || (this.isEditMode ? "Category updated successfully" : "Category created successfully"),
          "Close",
          {
            duration: 3000,
            panelClass: ["snackbar-success"],
          },
        );
        this.isLoading = false;
        this.resetForm();
        this.pageIndex = 0;
        this.loadCategories();
      },
      error: (err) => {
        this.isLoading = false;
        this.snackBar.open(
          err.error?.message || (this.isEditMode ? "Failed to update category" : "Failed to create category"),
          "Close",
          { duration: 3000, panelClass: ["snackbar-error"] },
        );
      },
    });
  }
}
