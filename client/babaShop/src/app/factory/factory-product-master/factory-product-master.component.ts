import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { FactoryProductService } from "app/shared/services/factory-product.service";
import { RawMaterialService } from "app/shared/services/raw-material.service";

@Component({
  selector: "app-factory-product-master",
  templateUrl: "./factory-product-master.component.html",
  styleUrls: ["./factory-product-master.component.css"],
})
export class FactoryProductMasterComponent implements OnInit {
  readonly unitOptions = ["PCS", "SET", "BOX", "KG", "FEET", "MTR"];
  readonly wasteUnitOptions = ["KG", "PCS", "FEET", "MTR"];

  productForm = {
    name: "",
    code: "",
    unitLabel: "PCS",
    workerPieceRate: 0,
    standardLabourCost: 0,
    standardOtherCost: 0,
    standardWasteQtyPerUnit: 0,
    standardWasteUnitLabel: "KG",
    standardWasteValuePerUnit: 0,
    standardMaterialLines: [] as any[],
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
  rawMaterialOptions: any[] = [];
  selectedProduct: any | null = null;
  editingProductId: string | null = null;
  loadingSummary = false;
  loadingProducts = false;
  loadingRawMaterials = false;
  savingProduct = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private factoryProductService: FactoryProductService,
    private rawMaterialService: RawMaterialService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadRawMaterials();
    this.loadAll();
  }

  get canManage(): boolean {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${this.userRole || ""}`);
  }

  loadAll(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loadingSummary = true;
    this.loadingProducts = true;
    this.factoryProductService.getProducts(this.filters).subscribe({
      next: (response) => {
        this.products = response?.products || [];
        this.selectedProduct = this.products[0] || null;
        this.summary = this.buildSummary(this.products);
        this.loadingSummary = false;
        this.loadingProducts = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.loadingProducts = false;
        this.showError(error?.error?.message || "Failed to load factory products");
      },
    });
  }

  loadRawMaterials(): void {
    this.loadingRawMaterials = true;
    this.rawMaterialService.getMaterials({ active: true }).subscribe({
      next: (response) => {
        this.rawMaterialOptions = response?.materials || [];
        this.loadingRawMaterials = false;
      },
      error: () => {
        this.rawMaterialOptions = [];
        this.loadingRawMaterials = false;
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
      workerPieceRate: Number(product.workerPieceRate || 0),
      standardLabourCost: Number(product.standardLabourCost || 0),
      standardOtherCost: Number(product.standardOtherCost || 0),
      standardWasteQtyPerUnit: Number(product.standardWasteQtyPerUnit || 0),
      standardWasteUnitLabel: product.standardWasteUnitLabel || "KG",
      standardWasteValuePerUnit: Number(product.standardWasteValuePerUnit || 0),
      standardMaterialLines: (product.standardMaterialLines || []).map((line: any) => ({
        rawMaterial: line.rawMaterial?._id || line.rawMaterial || "",
        materialName: line.materialName || line.rawMaterial?.name || "",
        qtyPerUnit: Number(line.qtyPerUnit || 0),
        unitLabel: line.unitLabel || line.rawMaterial?.unitLabel || "PCS",
        rate: Number(line.rate || line.rawMaterial?.currentRate || 0),
      })),
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
      workerPieceRate: 0,
      standardLabourCost: 0,
      standardOtherCost: 0,
      standardWasteQtyPerUnit: 0,
      standardWasteUnitLabel: "KG",
      standardWasteValuePerUnit: 0,
      standardMaterialLines: [],
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

  selectProduct(product: any): void {
    this.selectedProduct = product || null;
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

  get selectedProductTemplateCost(): number {
    return (this.selectedProduct?.standardMaterialLines || []).reduce((sum: number, line: any) => {
      return sum + (Number(line?.qtyPerUnit || 0) * Number(line?.rate || 0));
    }, 0);
  }

  addMaterialLine(): void {
    this.productForm.standardMaterialLines.push({
      rawMaterial: "",
      materialName: "",
      qtyPerUnit: 0,
      unitLabel: "PCS",
      rate: 0,
    });
  }

  removeMaterialLine(index: number): void {
    this.productForm.standardMaterialLines.splice(index, 1);
  }

  onMaterialChange(index: number): void {
    const line = this.productForm.standardMaterialLines[index];
    const material = this.rawMaterialOptions.find((row) => row?._id === line?.rawMaterial);
    if (!line || !material) {
      return;
    }
    line.materialName = material.name || "";
    line.unitLabel = material.unitLabel || "PCS";
    line.rate = Number(material.currentRate || 0);
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }

  private buildSummary(products: any[]): any {
    const byUnitMap = products.reduce((acc: Record<string, any>, row: any) => {
      const label = row?.unitLabel || "Unknown";
      if (!acc[label]) {
        acc[label] = { _id: label, count: 0 };
      }
      acc[label].count += 1;
      return acc;
    }, {});

    return {
      totalProducts: products.length,
      activeProducts: products.filter((row: any) => !!row?.active).length,
      inactiveProducts: products.filter((row: any) => !row?.active).length,
      byUnit: Object.values(byUnitMap),
    };
  }
}
