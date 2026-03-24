import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { FactoryProductService } from "app/shared/services/factory-product.service";

@Component({
  selector: "app-factory-product-master",
  templateUrl: "./factory-product-master.component.html",
  styleUrls: ["./factory-product-master.component.css"],
})
export class FactoryProductMasterComponent implements OnInit {
  readonly unitOptions = ["PCS", "SET", "BOX", "KG", "FEET", "MTR"];

  productForm = {
    name: "",
    code: "",
    unitLabel: "PCS",
    standardLabourCost: 0,
    standardOtherCost: 0,
    note: "",
    active: true,
  };

  filters = {
    search: "",
    active: "",
  };

  summary: any = {
    totalProducts: 0,
    activeProducts: 0,
    inactiveProducts: 0,
    byUnit: [],
  };

  products: any[] = [];
  editingProductId: string | null = null;
  loadingSummary = false;
  loadingProducts = false;
  savingProduct = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private factoryProductService: FactoryProductService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadAll();
  }

  get canManage(): boolean {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${this.userRole || ""}`);
  }

  loadAll(): void {
    this.loadSummary();
    this.loadProducts();
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.factoryProductService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load product summary");
      },
    });
  }

  loadProducts(): void {
    this.loadingProducts = true;
    this.factoryProductService.getProducts(this.filters).subscribe({
      next: (response) => {
        this.products = response?.products || [];
        this.loadingProducts = false;
      },
      error: (error) => {
        this.loadingProducts = false;
        this.showError(error?.error?.message || "Failed to load factory products");
      },
    });
  }

  submitProduct(form: NgForm): void {
    if (form.invalid || this.savingProduct) {
      return;
    }

    this.savingProduct = true;
    const request$ = this.editingProductId
      ? this.factoryProductService.updateProduct(this.editingProductId, this.productForm)
      : this.factoryProductService.createProduct(this.productForm);

    request$.subscribe({
      next: (response) => {
        this.savingProduct = false;
        this.snackBar.open(response?.message || "Factory product saved", "Close", { duration: 2500 });
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingProduct = false;
        this.showError(error?.error?.message || "Failed to save factory product");
      },
    });
  }

  startEdit(product: any): void {
    if (!this.canManage || !product?._id) {
      return;
    }
    this.editingProductId = product._id;
    this.productForm = {
      name: product.name || "",
      code: product.code || "",
      unitLabel: product.unitLabel || "PCS",
      standardLabourCost: Number(product.standardLabourCost || 0),
      standardOtherCost: Number(product.standardOtherCost || 0),
      note: product.note || "",
      active: !!product.active,
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingProductId = null;
    this.productForm = {
      name: "",
      code: "",
      unitLabel: "PCS",
      standardLabourCost: 0,
      standardOtherCost: 0,
      note: "",
      active: true,
    };
    if (form) {
      form.resetForm(this.productForm);
    }
  }

  clearFilters(): void {
    this.filters = { search: "", active: "" };
    this.loadProducts();
  }

  deleteProduct(product: any): void {
    if (!this.canManage || !product?._id || this.deletingId) {
      return;
    }
    const confirmed = window.confirm(`Delete factory product ${product.name}?`);
    if (!confirmed) {
      return;
    }
    this.deletingId = product._id;
    this.factoryProductService.deleteProduct(product._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Factory product deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete factory product");
      },
    });
  }

  getFormTitle(): string {
    return this.editingProductId ? "Edit Factory Product" : "Add Factory Product";
  }

  getSubmitLabel(): string {
    if (this.savingProduct) {
      return this.editingProductId ? "Updating..." : "Saving...";
    }
    return this.editingProductId ? "Update Product" : "Save Product";
  }

  trackBySummary(index: number, item: any): string {
    return `${item?._id || item?.name || "row"}-${index}`;
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }
}
