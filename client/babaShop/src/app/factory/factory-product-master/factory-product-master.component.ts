import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { FactoryProductService } from "app/shared/services/factory-product.service";
import { ProductModelService } from "app/shared/services/product-model.service";
import { ProductService } from "app/shared/services/product.service";
import { RawMaterialService } from "app/shared/services/raw-material.service";
import { VariationService } from "app/shared/services/variation.service";

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
    shopCategory: "",
    shopBrand: "",
    shopProduct: "",
    shopModel: "",
    shopVariation: "",
    variationColor: "",
    variationSize: "",
    defaultSellingPrice: 0,
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
  categoryOptions: any[] = [];
  brandOptions: any[] = [];
  shopProductOptions: any[] = [];
  shopModelOptions: any[] = [];
  shopVariationOptions: any[] = [];
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
    private categoryService: CategoryService,
    private brandService: BrandService,
    private productService: ProductService,
    private productModelService: ProductModelService,
    private variationService: VariationService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadAll();
    setTimeout(() => {
      this.loadRawMaterials();
      this.loadCategoryOptions();
      this.loadBrandOptions();
      this.loadShopProducts();
    }, 0);
    setTimeout(() => {
      this.loadShopModels();
      this.loadShopVariations();
    }, 120);
  }

  get canManage(): boolean {
    return this.authService.can("factory.product_master") && !this.authService.isGlobalReadOnlyMode();
  }

  loadAll(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loadingSummary = true;
    this.loadingProducts = true;
    const previousSelectedId = this.selectedProduct?._id || null;
    this.factoryProductService.getProducts(this.filters).subscribe({
      next: (response) => {
        this.products = response?.products || [];
        this.selectedProduct =
          this.products.find((row: any) => row?._id === previousSelectedId) ||
          this.products[0] ||
          null;
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

  loadCategoryOptions(): void {
    this.categoryService.getAllCategories().subscribe({
      next: (response) => {
        this.categoryOptions = response?.data || [];
      },
      error: () => {
        this.categoryOptions = [];
      },
    });
  }

  loadBrandOptions(): void {
    this.brandService.getAllBrands().subscribe({
      next: (response) => {
        this.brandOptions = response?.data || [];
      },
      error: () => {
        this.brandOptions = [];
      },
    });
  }

  loadShopProducts(): void {
    this.productService.getAllProducts().subscribe({
      next: (response) => {
        this.shopProductOptions = response?.data || [];
      },
      error: () => {
        this.shopProductOptions = [];
      },
    });
  }

  loadShopModels(): void {
    this.productModelService.getModels().subscribe({
      next: (response) => {
        this.shopModelOptions = response?.data || [];
      },
      error: () => {
        this.shopModelOptions = [];
      },
    });
  }

  loadShopVariations(): void {
    this.shopVariationOptions = [];
    this.variationService.getVariations({ limit: 300, sort: "sku" }).subscribe({
      next: (response) => {
        this.shopVariationOptions = response?.data || [];
      },
      error: (err) => {
        console.error("Variation load error:", err);
        this.shopVariationOptions = [];
      },
    });
  }

  submitProduct(form: NgForm): void {
    if (!this.canManage || form.invalid || this.savingProduct) {
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
      shopCategory: product.shopCategory?._id || product.shopCategory || "",
      shopBrand: product.shopBrand?._id || product.shopBrand || "",
      shopProduct: product.shopProduct?._id || product.shopProduct || "",
      shopModel: product.shopModel?._id || product.shopModel || "",
      shopVariation: product.shopVariation?._id || product.shopVariation || "",
      variationColor: product.variationColor || "",
      variationSize: product.variationSize || "",
      defaultSellingPrice: Number(product.defaultSellingPrice || 0),
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
      shopCategory: "",
      shopBrand: "",
      shopProduct: "",
      shopModel: "",
      shopVariation: "",
      variationColor: "",
      variationSize: "",
      defaultSellingPrice: 0,
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

  get filteredShopModelOptions(): any[] {
    const productId = `${this.productForm.shopProduct || ""}`.trim();
    if (!productId) {
      return this.shopModelOptions;
    }
    return this.shopModelOptions.filter((row) => `${row?.product?._id || row?.product || ""}` === productId);
  }

  get filteredShopVariationOptions(): any[] {
    const modelId = `${this.productForm.shopModel || ""}`.trim();
    const productId = `${this.productForm.shopProduct || ""}`.trim();
    return this.shopVariationOptions.filter((row) => {
      const rowProductId = `${row?.product?._id || row?.product || ""}`;
      const rowModelId = `${row?.model?._id || row?.model || ""}`;
      if (modelId) {
        return rowModelId === modelId;
      }
      if (productId) {
        return rowProductId === productId;
      }
      return true;
    });
  }

  get currentCategoryName(): string {
    return this.categoryOptions.find((row) => row?._id === this.productForm.shopCategory)?.name || "Auto from product";
  }

  get currentBrandName(): string {
    return this.brandOptions.find((row) => row?._id === this.productForm.shopBrand)?.name || "Auto from product";
  }

  get filteredBrandOptions(): any[] {
    const categoryId = `${this.productForm.shopCategory || ""}`.trim();
    if (!categoryId) {
      return this.brandOptions;
    }
    const category = this.categoryOptions.find((row) => row?._id === categoryId);
    if (!category) {
      return this.brandOptions;
    }
    const categoryBrandIds = Array.isArray(category?.brands)
      ? category.brands.map((b: any) => `${typeof b === "string" ? b : b?._id || ""}`)
      : [];
    return this.brandOptions.filter((brand) => categoryBrandIds.includes(`${brand?._id || ""}`));
  }

  onCategoryChange(): void {
    const categoryId = `${this.productForm.shopCategory || ""}`.trim();
    if (categoryId) {
      const category = this.categoryOptions.find((row) => row?._id === categoryId);
      const categoryBrandIds = Array.isArray(category?.brands)
        ? category.brands.map((b: any) => `${typeof b === "string" ? b : b?._id || ""}`)
        : [];
      if (categoryBrandIds.length > 0 && !categoryBrandIds.includes(this.productForm.shopBrand)) {
        this.productForm.shopBrand = "";
      }
    }
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

  onShopProductChange(): void {
    const product = this.shopProductOptions.find((row) => row?._id === this.productForm.shopProduct);
    if (!product) {
      this.productForm.name = "";
      this.productForm.shopCategory = "";
      this.productForm.shopBrand = "";
      this.productForm.shopModel = "";
      this.productForm.shopVariation = "";
      this.productForm.variationColor = "";
      this.productForm.variationSize = "";
      this.productForm.defaultSellingPrice = 0;
      return;
    }
    this.productForm.name = product.name || "";
    this.productForm.shopCategory = product.category?._id || product.category || "";
    this.productForm.shopBrand = product.brand?._id || product.brand || "";
    if (this.productForm.shopModel && !this.filteredShopModelOptions.some((row) => row?._id === this.productForm.shopModel)) {
      this.productForm.shopModel = "";
    }
    if (this.productForm.shopVariation && !this.filteredShopVariationOptions.some((row) => row?._id === this.productForm.shopVariation)) {
      this.productForm.shopVariation = "";
    }
  }

  onShopModelChange(): void {
    if (this.productForm.shopVariation && !this.filteredShopVariationOptions.some((row) => row?._id === this.productForm.shopVariation)) {
      this.productForm.shopVariation = "";
      this.productForm.variationColor = "";
      this.productForm.variationSize = "";
    }
  }

  onShopVariationChange(): void {
    const variation = this.shopVariationOptions.find((row) => row?._id === this.productForm.shopVariation);
    if (!variation) {
      this.productForm.variationColor = "";
      this.productForm.variationSize = "";
      return;
    }

    const productId = variation?.product?._id || variation?.product || "";
    const modelId = variation?.model?._id || variation?.model || "";
    if (productId) {
      this.productForm.shopProduct = productId;
      this.onShopProductChange();
    }
    if (modelId) {
      this.productForm.shopModel = modelId;
    }

    this.productForm.variationColor = variation?.attributes?.color || this.productForm.variationColor;
    this.productForm.variationSize = variation?.attributes?.size || this.productForm.variationSize;
    this.productForm.defaultSellingPrice = Number(variation?.sellingPrice || 0);
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
