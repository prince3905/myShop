import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { PageEvent } from "@angular/material/paginator";
import { ProductService } from "app/shared/services/product.service";
import { VariationService } from "app/shared/services/variation.service";
import { ProductModelService } from "app/shared/services/product-model.service";
import { AuthService } from "app/shared/services/auth.service";
import { ShopService } from "app/shared/services/shop.service";
import { firstValueFrom } from "rxjs";
import {
  LabelPrintOptionsDialogComponent,
  LabelPrintOptions,
} from "./label-print-options-dialog.component";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "app/shared/components/confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-add-detail",
  templateUrl: "./add-details.component.html",
  styleUrls: ["./add-details.component.css"],
})
export class AddDetailsComponent implements OnInit {
  productId!: string;
  variationId!: string | null;
  product: any = null;
  models: any[] = [];
  variations: any[] = [];
  totalVariations = 0;
  pageSize = 10;
  pageIndex = 0;
  searchSku = "";
  filterStatus: "all" | "active" | "inactive" = "all";
  filterModel = "";

  isEditMode = false;
  isLoading = false;
  listLoading = false;
  creatingModel = false;
  editingModelId: string | null = null;
  modelName = "";
  allowCodeRegenerationInEdit = false;
  canRegenerateCodes = true;
  codeLockMessage = "";

  variation: any = {
    model: "",
    sku: "",
    barcode: "",
    color: "",
    size: '',
    storage: "",
    costPrice: 0,
    sellingPrice: 0,
    isActive: true,
    isQuickAdd: false,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private variationService: VariationService,
    private productService: ProductService,
    private productModelService: ProductModelService,
    public authService: AuthService,
    private shopService: ShopService,
  ) {}

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get("productId")!;
    this.variationId = this.route.snapshot.paramMap.get("id");

    if (this.variationId) {
      this.isEditMode = true;
      this.loadVariation(this.variationId);
    }

    this.loadProduct();
    this.loadModels();
    this.loadVariations();
  }

  get canMutate(): boolean {
    return this.authService.can("inventory.product_details.manage") && !this.authService.isGlobalReadOnlyMode();
  }

  loadProduct() {
    this.productService.getProductById(this.productId).subscribe({
      next: (res: any) => {
        this.product = res?.data || res;
      },
      error: () => {
        this.snackBar.open("Failed to load product", "Close", { duration: 2500 });
      },
    });
  }

  loadModels() {
    this.productModelService.getModels({ product: this.productId }).subscribe({
      next: (res: any) => {
        this.models = Array.isArray(res?.data) ? res.data : [];
      },
      error: () => {
        this.snackBar.open("Failed to load models", "Close", { duration: 2500 });
      },
    });
  }

  loadVariations() {
    this.listLoading = true;
    const params: any = {
      product: this.productId,
      limit: this.pageSize,
      skip: this.pageIndex * this.pageSize,
      sort: "-createdAt",
    };
    if (this.searchSku.trim()) {
      params.sku = this.searchSku.trim();
    }
    if (this.filterStatus === "active") {
      params.isActive = "true";
    } else if (this.filterStatus === "inactive") {
      params.isActive = "false";
    }
    if (this.filterModel) {
      params.model = this.filterModel;
    }

    this.variationService.getVariations(params).subscribe({
      next: (res: any) => {
        this.variations = Array.isArray(res?.data) ? res.data : [];
        this.totalVariations = Number(res?.total || this.variations.length);
        this.listLoading = false;
      },
      error: () => {
        this.listLoading = false;
        this.snackBar.open("Failed to load variations", "Close", { duration: 2500 });
      },
    });
  }

  loadVariation(id: string) {
    this.variationService.getVariationById(id).subscribe({
      next: (res: any) => {
        const v = res?.data;
        if (!v) return;
        this.variation = {
          model: v.model?._id || v.model || "",
          sku: v.sku || "",
          barcode: v.barcode || "",
          color: v.attributes?.color || "",
          size: v.attributes?.size || "",
          storage: v.attributes?.storage || "",
          costPrice: Number(v.costPrice || 0),
          sellingPrice: Number(v.sellingPrice || 0),
          isActive: v.isActive !== false,
          isQuickAdd: !!v.isQuickAdd,
        };
        this.allowCodeRegenerationInEdit = false;
        this.loadVariationUsage(v._id);
      },
      error: (err) => {
        if (Number(err?.status || 0) === 404) {
          this.snackBar.open("Variation not found. Switched to create mode.", "Close", {
            duration: 2800,
          });
          this.resetForm();
          this.router.navigate(["/add-detail", this.productId], { replaceUrl: true });
          return;
        }
        this.snackBar.open("Failed to load variation", "Close", { duration: 2500 });
      },
    });
  }

  saveVariation() {
    if (!this.canMutate) {
      this.snackBar.open("You do not have permission", "Close", { duration: 2500 });
      return;
    }
    const generatedSku = this.generateSku();
    const generatedBarcode = this.generateBarcodeFromSku(generatedSku);

    const finalSku = this.isEditMode && !this.allowCodeRegenerationInEdit
      ? (this.variation.sku || "")
      : generatedSku;
    const finalBarcode = this.isEditMode && !this.allowCodeRegenerationInEdit
      ? (this.variation.barcode || "")
      : generatedBarcode;

    if (!this.variation.model || !finalSku || !finalBarcode) {
      this.snackBar.open("Model, storage and color are required for SKU/Barcode", "Close", { duration: 3000 });
      return;
    }

    this.isLoading = true;

    const payload = {
      product: this.productId,
      model: this.variation.model,
      sku: finalSku,
      barcode: finalBarcode,
      attributes: {
        color: this.variation.color || "",
        size: this.variation.size || "",
        storage: this.variation.storage || "",
      },
      costPrice: Number(this.variation.costPrice || 0),
      sellingPrice: Number(this.variation.sellingPrice || 0),
      isActive: !!this.variation.isActive,
      isQuickAdd: !!this.variation.isQuickAdd,
    };

    const req$ = this.isEditMode
      ? this.variationService.updateVariation(this.variationId!, payload)
      : this.variationService.createVariation(payload);

    req$.subscribe({
      next: () => {
        this.snackBar.open(
          this.isEditMode ? "Variation updated" : "Variation created",
          "Close",
          { duration: 2500 },
        );
        this.isLoading = false;
        this.resetForm();
        this.loadVariations();
      },
      error: (err) => {
        this.isLoading = false;
        const status = Number(err?.status || 0);
        const errorMsg = err?.error?.message || "";

        if (status === 404 && this.isEditMode) {
          this.snackBar.open("Variation no longer exists. Switched to create mode.", "Close", {
            duration: 3000,
          });
          this.resetForm();
          this.router.navigate(["/add-detail", this.productId], { replaceUrl: true });
          this.loadVariations();
          return;
        }

        let friendlyMsg = errorMsg;
        if (status === 409 || errorMsg.includes("already exists")) {
          if (errorMsg.toLowerCase().includes("sku")) {
            friendlyMsg = "This SKU already exists. Please change color/storage or regenerate SKU.";
          } else if (errorMsg.toLowerCase().includes("barcode")) {
            friendlyMsg = "This barcode already exists. Please regenerate.";
          } else {
            friendlyMsg = "Duplicate entry: This variation already exists for this shop.";
          }
        }

        this.snackBar.open(friendlyMsg || "Operation failed", "Close", {
          duration: 4000,
        });
      },
    });
  }

  toggleStatus(v: any) {
    if (!this.canMutate) return;
    this.variationService
      .updateVariation(v._id, { isActive: !v.isActive })
      .subscribe({
        next: () => {
          this.snackBar.open("Variation status updated", "Close", { duration: 2500 });
          this.loadVariations();
        },
        error: (err) => {
          this.snackBar.open(err?.error?.message || "Failed to update status", "Close", {
            duration: 3000,
          });
        },
      });
  }

  editVariation(v: any) {
    if (!this.canMutate) return;
    this.isEditMode = true;
    this.variationId = v._id;
    this.variation = {
      model: v.model?._id || v.model || "",
      sku: v.sku || "",
      barcode: v.barcode || "",
      color: v.attributes?.color || "",
      size: v.attributes?.size || "",
      storage: v.attributes?.storage || "",
      costPrice: Number(v.costPrice || 0),
      sellingPrice: Number(v.sellingPrice || 0),
      isActive: v.isActive !== false,
      isQuickAdd: !!v.isQuickAdd,
    };
    this.allowCodeRegenerationInEdit = false;
    this.loadVariationUsage(v._id);
  }

  deleteVariation(v: any) {
    if (!this.canMutate) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: "460px",
      maxWidth: "95vw",
      disableClose: true,
      data: {
        mode: "confirm",
        title: "Delete Variation",
        message: `Delete variation "${v?.sku || "this variation"}"?`,
        confirmText: "Delete",
        cancelText: "Cancel",
      } as ConfirmDialogData,
    });

    ref.afterClosed().subscribe((ok: boolean) => {
      if (!ok) return;

      this.variationService.deleteVariation(v._id).subscribe({
        next: () => {
          this.snackBar.open("Variation deleted", "Close", { duration: 2500 });
          this.loadVariations();
        },
        error: (err) => {
          const msg = this.getDeleteVariationErrorMessage(err);
          this.snackBar.open(msg, "Close", { duration: 4200 });
          if (Number(err?.status || 0) === 409) {
            this.dialog.open(ConfirmDialogComponent, {
              width: "460px",
              maxWidth: "95vw",
              data: {
                mode: "info",
                title: "Delete Blocked",
                message: "This variation is used in transactions. Please deactivate instead of deleting.",
                usage: err?.error?.usage || {},
              } as ConfirmDialogData,
            });
          }
        },
      });
    });
  }

  private getDeleteVariationErrorMessage(err: any): string {
    const status = Number(err?.status || 0);
    const usage = err?.error?.usage || {};

    if (status === 409) {
      const saleCount = Number(usage?.saleCount || 0);
      const orderCount = Number(usage?.orderCount || 0);
      const purchaseCount = Number(usage?.purchaseCount || 0);
      return `Cannot delete: used in Sale(${saleCount}), Order(${orderCount}), Purchase(${purchaseCount}). Deactivate instead.`;
    }

    return err?.error?.message || "Delete failed";
  }

  getSelectedModel(): any {
    return this.models.find((m) => m._id === this.variation.model);
  }

  saveModel(): void {
    if (this.editingModelId) {
      this.updateModel();
    } else {
      this.createModel();
    }
  }

  createModel() {
    if (!this.canMutate) return;
    const name = (this.modelName || "").trim();
    if (!name) {
      this.snackBar.open("Model name is required", "Close", { duration: 2500 });
      return;
    }

    this.creatingModel = true;
    this.productModelService
      .createModel({ product: this.productId, name })
      .subscribe({
        next: (res: any) => {
          this.creatingModel = false;
          this.modelName = "";
          this.snackBar.open("Model created successfully", "Close", { duration: 2500 });
          const model = res?.data;
          if (model) {
            this.models = [model, ...this.models];
            this.variation.model = model._id;
            this.refreshSku();
          } else {
            this.loadModels();
          }
        },
        error: (err) => {
          this.creatingModel = false;
          this.snackBar.open(err?.error?.message || "Failed to create model", "Close", {
            duration: 3000,
          });
        },
      });
  }

  startEditModel(model: any): void {
    if (!this.canMutate || !model?._id) return;

    const hasVariations = this.variations.some(
      (v) => `${v.model?._id || v.model || ""}` === `${model._id}`
    );

    if (hasVariations) {
      this.snackBar.open(
        `Is Model (${model.name}) ke sath pehle se Variations judi hui hain. Edit ya Delete karne ke liye pehle iski sabhi Variations delete karein.`,
        "Close",
        { duration: 4500, panelClass: ["snackbar-error"] }
      );
      return;
    }

    this.editingModelId = model._id;
    this.modelName = model.name;
    this.snackBar.open(`Editing Model: ${model.name}. Change name in the box and click Save.`, "Close", { duration: 3000 });
  }

  cancelEditModel(): void {
    this.editingModelId = null;
    this.modelName = "";
  }

  updateModel(): void {
    if (!this.canMutate || !this.editingModelId) return;
    const name = (this.modelName || "").trim();
    if (!name) {
      this.snackBar.open("Model name is required", "Close", { duration: 2500 });
      return;
    }

    this.creatingModel = true;
    this.productModelService.updateModel(this.editingModelId, { name }).subscribe({
      next: () => {
        this.creatingModel = false;
        this.snackBar.open("Model updated successfully", "Close", { duration: 2500 });
        this.editingModelId = null;
        this.modelName = "";
        this.loadModels();
      },
      error: (err: any) => {
        this.creatingModel = false;
        this.snackBar.open(err?.error?.message || "Failed to update model", "Close", { duration: 4000 });
      },
    });
  }

  deleteModel(model: any): void {
    if (!this.canMutate || !model?._id) return;

    const hasVariations = this.variations.some(
      (v) => `${v.model?._id || v.model || ""}` === `${model._id}`
    );

    if (hasVariations) {
      this.snackBar.open(
        `Is Model (${model.name}) ke sath pehle se Variations judi hui hain. Delete karne se pehle iski sabhi Variations delete karein.`,
        "Close",
        { duration: 4500, panelClass: ["snackbar-error"] }
      );
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete model "${model.name}"?`);
    if (!confirmed) return;

    this.productModelService.deleteModel(model._id).subscribe({
      next: () => {
        this.snackBar.open("Model deleted successfully", "Close", { duration: 2500 });
        if (this.variation.model === model._id) {
          this.variation.model = "";
        }
        if (this.editingModelId === model._id) {
          this.editingModelId = null;
          this.modelName = "";
        }
        this.loadModels();
      },
      error: (err: any) => {
        this.snackBar.open(err?.error?.message || "Failed to delete model", "Close", { duration: 4000 });
      },
    });
  }

  printVariationLabel(v: any): void {
    this.printVariationLabelWithOptions(v, 1, "50x30");
  }

  printVariationLabelBulk(v: any): void {
    const dialogRef = this.dialog.open(LabelPrintOptionsDialogComponent, {
      width: "420px",
      maxWidth: "94vw",
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: LabelPrintOptions | null) => {
      if (!result) return;
      this.printVariationLabelWithOptions(v, result.quantity, result.size);
    });
  }

  private printVariationLabelWithOptions(
    v: any,
    quantity: number,
    labelSize: "50x30" | "38x25",
  ): void {
    this.resolveShopLabelForPrint().then((shopName) => {
      this.openVariationLabelPrint(v, quantity, labelSize, shopName);
    });
  }

  private openVariationLabelPrint(
    v: any,
    quantity: number,
    labelSize: "50x30" | "38x25",
    shopName: string,
  ): void {
    const barcode = `${v?.barcode || ""}`.trim();
    if (!barcode) {
      this.snackBar.open("Barcode not available for this variation", "Close", { duration: 2500 });
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      this.snackBar.open("Please allow popups to print labels", "Close", { duration: 3000 });
      return;
    }

    const productName = this.product?.name || "Product";
    const brandName = this.product?.brand?.name || "";
    const modelName = v?.model?.name || "-";
    const sku = v?.sku || "-";
    const sellingPrice = Number(v?.sellingPrice || 0);
    const attrs = [
      v?.attributes?.color || "-",
      v?.attributes?.size || "-",
      v?.attributes?.storage || "-",
    ].join(" / ");

    const barcodeSvg = this.generateEan13Svg(barcode);
    const page = this.getLabelPageSpec(labelSize);
    const shopClass = this.getShopClassForPrint(shopName);
    const cards = Array.from({ length: quantity })
      .map(
        () => `
        <div class="label">
          <div class="${shopClass}">${this.escapeHtml(shopName)}</div>
          ${brandName ? `<div class="brand">${this.escapeHtml(brandName)}</div>` : ""}
          <div class="name">${this.escapeHtml(productName)}</div>
          <div class="meta">${this.escapeHtml(modelName)}</div>
          <div class="meta">SKU: ${this.escapeHtml(sku)}</div>
          <div class="meta">${this.escapeHtml(attrs)}</div>
          <div class="barcode-wrap">${barcodeSvg}</div>
          <div class="barcode-text">${this.escapeHtml(barcode)}</div>
          <div class="price">MRP: INR ${sellingPrice.toFixed(2)}</div>
        </div>`,
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Print Label</title>
        <style>
          @page { size: A4 portrait; margin: 6mm; }
          body { margin: 0; font-family: Arial, sans-serif; }
          .sheet {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(${page.labelWidthMm}mm, 1fr));
            gap: 3mm;
            align-content: start;
          }
          .label {
            width: ${page.labelWidthMm}mm;
            min-height: ${page.labelHeightMm}mm;
            border: 1px solid #000;
            padding: 2mm;
            box-sizing: border-box;
            page-break-inside: avoid;
          }
          .shop {
            font-size: ${page.shopFont}px;
            font-weight: 800;
            line-height: 1.1;
            text-align: left;
            letter-spacing: 0.1px;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .shop.shop-medium { font-size: ${Math.max(page.shopFont - 1, 6)}px; }
          .shop.shop-long { font-size: ${Math.max(page.shopFont - 2, 6)}px; line-height: 1.05; }
          .brand { font-size: ${Math.max(page.shopFont - 1, 7)}px; font-weight: 700; line-height: 1.15; margin-top: 1px; text-align: left; overflow-wrap: anywhere; }
          .name {
            font-size: ${Math.max(page.nameFont - 1, 7)}px;
            font-weight: 700;
            line-height: 1.1;
            text-align: left;
            margin-top: 1px;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          .meta { font-size: ${page.metaFont}px; margin-top: 1px; line-height: 1.15; text-align: left; overflow-wrap: anywhere; }
          .barcode-wrap { margin-top: 2px; text-align: center; }
          .barcode-wrap svg { width: 100%; height: ${page.barcodeHeightMm}mm; }
          .barcode-text { font-size: ${page.codeFont}px; letter-spacing: 0.6px; margin-top: 1px; text-align: center; }
          .price { margin-top: 1px; font-size: ${page.priceFont}px; font-weight: 700; text-align: right; }
        </style>
      </head>
      <body>
        <div class="sheet">${cards}</div>
      </body>
      </html>
    `;

    if (v?._id) {
      this.variationService
        .logLabelPrint(v._id, { quantity, size: labelSize })
        .subscribe({ error: () => {} });
    }

    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
          // Keep window open to avoid silent close in stricter browsers.
        } catch (err) {
          this.snackBar.open("Print failed. Please try again.", "Close", { duration: 3000 });
        }
      }, 250);
    } catch (err) {
      this.snackBar.open("Unable to open print preview", "Close", { duration: 3000 });
    }
  }

  resetForm() {
    this.isEditMode = false;
    this.variationId = null;
    this.variation = {
      model: "",
      sku: "",
      barcode: "",
      color: "",
      size: "",
      storage: "",
      costPrice: 0,
      sellingPrice: 0,
      isActive: true,
      isQuickAdd: false,
    };
    this.allowCodeRegenerationInEdit = false;
    this.canRegenerateCodes = true;
    this.codeLockMessage = "";
  }

  onVariationMetaChange(): void {
    if (this.isEditMode && !this.allowCodeRegenerationInEdit) {
      return;
    }
    this.refreshSku();
  }

  regenerateCodesInEdit(): void {
    if (!this.isEditMode) return;
    if (!this.canRegenerateCodes) {
      this.snackBar.open(this.codeLockMessage || "Code regeneration is locked", "Close", {
        duration: 2800,
      });
      return;
    }
    this.allowCodeRegenerationInEdit = true;
    this.refreshSku();
    this.snackBar.open("SKU/Barcode regenerated", "Close", { duration: 2000 });
  }

  private loadVariationUsage(variationId: string): void {
    this.canRegenerateCodes = true;
    this.codeLockMessage = "";
    if (!variationId) return;

    this.variationService.getVariationUsage(variationId).subscribe({
      next: (res: any) => {
        const usage = res?.data;
        const can = !!usage?.canRegenerateCodes;
        this.canRegenerateCodes = can;
        if (!can) {
          this.codeLockMessage =
            `Locked: used in ${usage?.saleCount || 0} sale(s) and ${usage?.orderCount || 0} order(s).`;
        }
      },
      error: () => {
        this.canRegenerateCodes = true;
        this.codeLockMessage = "";
      },
    });
  }

  private refreshSku(): void {
    this.variation.sku = this.generateSku();
    this.variation.barcode = this.generateBarcodeFromSku(this.variation.sku);
  }

  private generateSku(): string {
    const modelName = this.getSelectedModelName();
    const modelToken = this.getModelToken(modelName);
    const storageToken = this.getStorageToken(this.variation.storage);
    const colorToken = this.getColorToken(this.variation.color);

    if (!modelToken || !storageToken || !colorToken) return "";

    const baseSku = `${modelToken}-${storageToken}-${colorToken}`;
    return this.ensureUniqueSku(baseSku);
  }

  private getSelectedModelName(): string {
    const selected = this.models.find((m: any) => m._id === this.variation.model);
    return (selected?.name || "").toString();
  }

  private getModelToken(modelName: string): string {
    const cleaned = (modelName || "").trim().toUpperCase();
    if (!cleaned) return "";

    const alphaNumMatch = cleaned.match(/\b[A-Z]+\d+[A-Z0-9]*\b/);
    if (alphaNumMatch?.[0]) return alphaNumMatch[0];

    const words = cleaned.replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    if (!words.length) return "";

    if (words.length === 1) {
      return words[0].slice(0, 4);
    }
    return `${words[0][0] || ""}${words[1][0] || ""}${(words[2]?.[0] || "")}`.slice(0, 4);
  }

  private getStorageToken(storage: string): string {
    const raw = (storage || "").trim().toUpperCase();
    if (!raw) return "";
    const numberMatch = raw.match(/\d+/);
    if (numberMatch?.[0]) return numberMatch[0];
    return raw.replace(/[^A-Z0-9]/g, "").slice(0, 4);
  }

  private getColorToken(color: string): string {
    const raw = (color || "").trim().toUpperCase();
    if (!raw) return "";
    const map: Record<string, string> = {
      BLACK: "BLK",
      WHITE: "WHT",
      SILVER: "SLV",
      GOLD: "GLD",
      BLUE: "BLU",
      GREEN: "GRN",
      RED: "RED",
      GRAY: "GRY",
      GREY: "GRY",
      PURPLE: "PRP",
      PINK: "PNK",
    };
    if (map[raw]) return map[raw];
    return raw.replace(/[^A-Z0-9]/g, "").slice(0, 3);
  }

  private ensureUniqueSku(baseSku: string): string {
    const currentEditingId = this.isEditMode ? this.variationId : null;
    const used = new Set(
      (this.variations || [])
        .filter((v: any) => v?._id !== currentEditingId)
        .map((v: any) => (v?.sku || "").toUpperCase())
        .filter(Boolean),
    );

    if (!used.has(baseSku.toUpperCase())) return baseSku;

    let index = 2;
    let candidate = `${baseSku}-${index}`;
    while (used.has(candidate.toUpperCase())) {
      index += 1;
      candidate = `${baseSku}-${index}`;
    }
    return candidate;
  }

  private generateBarcodeFromSku(sku: string): string {
    const normalized = (sku || "").trim().toUpperCase();
    if (!normalized) return "";

    const used = new Set(
      (this.variations || [])
        .filter((v: any) => v?._id !== (this.isEditMode ? this.variationId : null))
        .map((v: any) => `${v?.barcode || ""}`)
        .filter(Boolean),
    );

    let salt = 0;
    let candidate = this.makeEan13FromText(normalized, salt);
    while (used.has(candidate)) {
      salt += 1;
      candidate = this.makeEan13FromText(normalized, salt);
    }
    return candidate;
  }

  private makeEan13FromText(text: string, salt: number): string {
    let hash = 0;
    const seedText = `${text}-${salt}`;
    for (let i = 0; i < seedText.length; i += 1) {
      hash = (hash * 31 + seedText.charCodeAt(i)) % 1000000000000;
    }

    const body12 = String(Math.abs(hash)).padStart(12, "0").slice(0, 12);
    let sum = 0;
    for (let i = 0; i < body12.length; i += 1) {
      const digit = Number(body12[i] || 0);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return `${body12}${checkDigit}`;
  }

  private generateEan13Svg(rawCode: string): string {
    const code = `${rawCode}`.replace(/\D/g, "").slice(0, 13);
    if (code.length !== 13) {
      return `<div style="font-size:8px;color:#b00020">Invalid barcode</div>`;
    }

    const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
    const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
    const R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
    const PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

    const first = Number(code[0]);
    const left = code.slice(1, 7).split("").map((d) => Number(d));
    const right = code.slice(7).split("").map((d) => Number(d));
    const parityPattern = PARITY[first];

    let bits = "101";
    for (let i = 0; i < left.length; i += 1) {
      bits += parityPattern[i] === "L" ? L[left[i]] : G[left[i]];
    }
    bits += "01010";
    for (let i = 0; i < right.length; i += 1) {
      bits += R[right[i]];
    }
    bits += "101";

    const barW = 1.05;
    const h = 58;
    const w = bits.length * barW;
    let x = 0;
    let rects = "";
    for (const bit of bits) {
      if (bit === "1") {
        rects += `<rect x="${x.toFixed(2)}" y="0" width="${barW}" height="${h}" fill="#000"/>`;
      }
      x += barW;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(2)} ${h}" preserveAspectRatio="none">${rects}</svg>`;
  }

  private escapeHtml(value: string): string {
    return `${value || ""}`
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private getLabelPageSpec(size: "50x30" | "38x25") {
    if (size === "38x25") {
      return {
        labelWidthMm: 38,
        labelHeightMm: 25,
        barcodeHeightMm: 7.5,
        shopFont: 8,
        nameFont: 8,
        metaFont: 6,
        codeFont: 7,
        priceFont: 7,
      };
    }
    return {
      labelWidthMm: 50,
      labelHeightMm: 30,
      barcodeHeightMm: 11,
      shopFont: 9,
      nameFont: 9,
      metaFont: 7,
      codeFont: 8,
      priceFont: 8,
    };
  }

  private async resolveShopLabelForPrint(): Promise<string> {
    const currentUser = this.authService.getCurrentUser() || {};
    const currentShopName = `${currentUser?.shopName || ""}`.trim();
    if (currentShopName) {
      return currentShopName;
    }

    if (this.authService.isSuperAdmin() && !currentUser?.shop) {
      return "GLOBAL";
    }

    try {
      const selectedShopId = this.shopService.getSelectedShop();
      if (selectedShopId) {
        const response: any = await firstValueFrom(this.shopService.getAllShops());
        const shops = Array.isArray(response?.data) ? response.data : [];
        const selectedShop = shops.find((shop: any) => shop?._id === selectedShopId);
        const selectedShopName = `${selectedShop?.name || ""}`.trim();
        if (selectedShopName) {
          return selectedShopName;
        }
      }
    } catch (error) {
      // Fall through to safe non-mutating fallback.
    }

    const productShopName = `${this.product?.shop?.name || this.product?.shopName || ""}`.trim();
    if (productShopName) {
      return productShopName;
    }

    return this.getShopLabelForPrint(currentUser);
  }

  private getShopLabelForPrint(user: any = this.authService.getCurrentUser() || {}): string {
    const shopName = `${user?.shopName || ""}`.trim();
    if (shopName) return shopName;
    if (user?.shopCode) return user.shopCode;
    if (this.authService.isSuperAdmin() && !user?.shop) return "GLOBAL";
    return "Shop";
  }

  private getShopClassForPrint(shopName: string): string {
    const label = `${shopName || ""}`.trim();
    if (label.length > 24) return "shop shop-long";
    if (label.length > 16) return "shop shop-medium";
    return "shop";
  }

  applyFilters() {
    this.pageIndex = 0;
    this.loadVariations();
  }

  resetFilters() {
    this.searchSku = "";
    this.filterStatus = "all";
    this.filterModel = "";
    this.pageIndex = 0;
    this.loadVariations();
  }

  onPageChange(event: PageEvent) {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.loadVariations();
  }
}
