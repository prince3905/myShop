import { Component, OnInit } from "@angular/core";
import { FormArray, FormBuilder, FormGroup, Validators } from "@angular/forms";
import { PageEvent } from "@angular/material/paginator";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { DistributorService } from "app/shared/services/distributor.service";
import { ProductService } from "app/shared/services/product.service";
import { PurchaseService } from "app/shared/services/purchase.service";
import { AuthService } from "app/shared/services/auth.service";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "app/shared/components/confirm-dialog/confirm-dialog.component";
import { PurchaseReturnDialogComponent } from "../purchase-return-dialog/purchase-return-dialog.component";

@Component({
  selector: "app-purchase-console",
  templateUrl: "./purchase-console.component.html",
  styleUrls: ["./purchase-console.component.css"],
})
export class PurchaseConsoleComponent implements OnInit {
  purchaseForm: FormGroup;
  distributors: any[] = [];
  products: any[] = [];
  purchases: any[] = [];
  totalPurchases = 0;
  page = 1;
  pageSize = 10;
  pageSizeOptions: number[] = [10, 20, 30, 50];
  sortBy: "createdAt" | "purchaseDate" | "grandTotal" | "status" | "invoiceNo" = "createdAt";
  sortOrder: "asc" | "desc" = "desc";
  selectedPurchase: any = null;
  purchaseReturns: any[] = [];
  purchaseReturnSummary: any = null;
  detailInvoiceRef = "";
  drawerOpen = false;
  editingPurchaseId: string | null = null;
  rowModelsByIndex: Record<number, any[]> = {};
  rowVariationsByIndex: Record<number, any[]> = {};
  loading = false;
  saving = false;
  confirmingIds: Record<string, boolean> = {};
  cancelingIds: Record<string, boolean> = {};
  purchaseFilters: {
    search: string;
    status: string | null;
    returnStatus: string | null;
    distributor: string | null;
    dateFrom: Date | null;
    dateTo: Date | null;
  } = {
    search: "",
    status: null,
    returnStatus: null,
    distributor: null,
    dateFrom: null,
    dateTo: null,
  };
  readonly paymentMethods = ["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"];

  constructor(
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private distributorService: DistributorService,
    private productService: ProductService,
    private purchaseService: PurchaseService,
    public authService: AuthService,
  ) {
    this.purchaseForm = this.fb.group({
      distributor: [null, Validators.required],
      invoiceNo: [""],
      purchaseDate: [new Date(), Validators.required],
      discountAmount: [0],
      paidAmount: [0],
      paymentMethod: ["CASH", Validators.required],
      note: [""],
      items: this.fb.array([this.createItemRow()]),
    });
  }

  ngOnInit(): void {
    this.loadDistributors();
    this.loadProducts();
    this.loadPurchases();
  }

  get canMutatePurchase(): boolean {
    const role = this.authService.getUserRole();
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role || "");
  }

  get draftCount(): number {
    return this.purchases.filter((p: any) => `${p?.status || ""}`.toUpperCase() === "DRAFT").length;
  }

  get confirmedCount(): number {
    return this.purchases.filter((p: any) => `${p?.status || ""}`.toUpperCase() === "CONFIRMED").length;
  }

  get itemsFormArray(): FormArray {
    return this.purchaseForm.get("items") as FormArray;
  }

  createItemRow(): FormGroup {
    return this.fb.group({
      variation: [null, Validators.required],
      product: [null, Validators.required],
      model: [null, Validators.required],
      sku: ["", Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      freeQuantity: [0, [Validators.min(0)]],
      purchasePrice: [0, [Validators.required, Validators.min(0)]],
      taxPercent: [0, [Validators.min(0)]],
      discountAmount: [0, [Validators.min(0)]],
    });
  }

  addItemRow(): void {
    this.itemsFormArray.push(this.createItemRow());
    this.rebuildAllRowOptionCaches();
  }

  removeItemRow(index: number): void {
    if (this.itemsFormArray.length <= 1) return;
    this.itemsFormArray.removeAt(index);
    this.rebuildAllRowOptionCaches();
  }

  loadDistributors(): void {
    this.distributorService.getDistributor({ page: 1, perPage: 200 }).subscribe({
      next: (res: any) => {
        this.distributors = Array.isArray(res?.distributors)
          ? res.distributors
          : Array.isArray(res?.distributor)
            ? res.distributor
          : Array.isArray(res?.data)
            ? res.data
            : [];
      },
      error: () => {
        this.snackBar.open("Failed to load distributors", "Close", { duration: 2500 });
      },
    });
  }

  loadProducts(): void {
    this.productService.getAllProducts().subscribe({
      next: (res: any) => {
        this.products = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        this.rebuildAllRowOptionCaches();
      },
      error: () => {
        this.snackBar.open("Failed to load products", "Close", { duration: 2500 });
      },
    });
  }

  loadPurchases(): void {
    this.loading = true;
    const params: any = {
      page: this.page,
      limit: this.pageSize,
      sortBy: this.sortBy,
      order: this.sortOrder,
      search: this.purchaseFilters.search?.trim() || undefined,
      status: this.purchaseFilters.status || undefined,
      returnStatus: this.purchaseFilters.returnStatus || undefined,
      distributor: this.purchaseFilters.distributor || undefined,
      dateFrom: this.purchaseFilters.dateFrom
        ? this.formatDateForApi(this.purchaseFilters.dateFrom)
        : undefined,
      dateTo: this.purchaseFilters.dateTo ? this.formatDateForApi(this.purchaseFilters.dateTo) : undefined,
    };
    this.purchaseService.listPurchases(params).subscribe({
      next: (res: any) => {
        this.purchases = Array.isArray(res?.data) ? res.data : [];
        this.totalPurchases = Number(res?.total || 0);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open("Failed to load purchases", "Close", { duration: 2500 });
      },
    });
  }

  applyPurchaseFilters(): void {
    this.page = 1;
    this.loadPurchases();
  }

  clearPurchaseFilters(): void {
    this.purchaseFilters = {
      search: "",
      status: null,
      returnStatus: null,
      distributor: null,
      dateFrom: null,
      dateTo: null,
    };
    this.page = 1;
    this.loadPurchases();
  }

  removeFilterChip(key: "search" | "status" | "returnStatus" | "distributor" | "dateFrom" | "dateTo"): void {
    if (key === "search") this.purchaseFilters.search = "";
    if (key === "status") this.purchaseFilters.status = null;
    if (key === "returnStatus") this.purchaseFilters.returnStatus = null;
    if (key === "distributor") this.purchaseFilters.distributor = null;
    if (key === "dateFrom") this.purchaseFilters.dateFrom = null;
    if (key === "dateTo") this.purchaseFilters.dateTo = null;
    this.page = 1;
    this.loadPurchases();
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadPurchases();
  }

  applySort(): void {
    this.page = 1;
    this.loadPurchases();
  }

  toggleSort(column: "purchaseDate" | "grandTotal" | "status" | "invoiceNo"): void {
    if (this.sortBy === column) {
      this.sortOrder = this.sortOrder === "asc" ? "desc" : "asc";
    } else {
      this.sortBy = column;
      this.sortOrder = column === "invoiceNo" || column === "status" ? "asc" : "desc";
    }
    this.applySort();
  }

  isSortActive(column: "purchaseDate" | "grandTotal" | "status" | "invoiceNo"): boolean {
    return this.sortBy === column;
  }

  getSortIcon(column: "purchaseDate" | "grandTotal" | "status" | "invoiceNo"): string {
    if (this.sortBy !== column) return "unfold_more";
    return this.sortOrder === "asc" ? "arrow_upward" : "arrow_downward";
  }

  getDistributorNameById(id: string | null): string {
    if (!id) return "-";
    const d = this.distributors.find((x: any) => `${x?._id}` === `${id}`);
    return d?.name || id;
  }

  onProductSelected(index: number): void {
    const row = this.itemsFormArray.at(index);
    if (!row) return;
    row.patchValue({
      model: null,
      variation: null,
      sku: "",
      purchasePrice: 0,
    }, { emitEvent: false });

    const productId = `${row?.value?.product || ""}`;
    this.rowModelsByIndex[index] = this.buildModelsForProduct(productId);
    this.rowVariationsByIndex[index] = [];
  }

  onModelSelected(index: number): void {
    const row = this.itemsFormArray.at(index);
    if (!row) return;
    row.patchValue({
      variation: null,
      sku: "",
      purchasePrice: 0,
    }, { emitEvent: false });

    const productId = `${row?.value?.product || ""}`;
    const modelId = `${row?.value?.model || ""}`;
    this.rowVariationsByIndex[index] = this.buildVariations(productId, modelId);
  }

  onVariationSelected(index: number, variationId: string): void {
    const selected = (this.rowVariationsByIndex[index] || []).find(
      (v: any) => `${v?._id}` === `${variationId}`,
    );
    if (!selected) return;

    this.itemsFormArray.at(index).patchValue({
      variation: selected._id,
      sku: selected.sku,
      purchasePrice: Number(selected.costPrice || 0),
    });
  }

  isProductSelected(index: number): boolean {
    const row = this.itemsFormArray.at(index);
    return !!row?.value?.product;
  }

  isModelSelected(index: number): boolean {
    const row = this.itemsFormArray.at(index);
    return !!row?.value?.model;
  }

  getRowTotal(index: number): number {
    const row = this.itemsFormArray.at(index)?.value || {};
    const qty = Number(row.quantity || 0);
    const price = Number(row.purchasePrice || 0);
    const tax = Number(row.taxPercent || 0);
    const discount = Number(row.discountAmount || 0);
    const base = qty * price;
    return Math.max(0, base + (base * tax) / 100 - discount);
  }

  getGrandTotalPreview(): number {
    const itemTotal = this.itemsFormArray.controls.reduce((acc, ctrl) => {
      const row = ctrl.value;
      const qty = Number(row.quantity || 0);
      const price = Number(row.purchasePrice || 0);
      const tax = Number(row.taxPercent || 0);
      const rowDiscount = Number(row.discountAmount || 0);
      const base = qty * price;
      return acc + Math.max(0, base + (base * tax) / 100 - rowDiscount);
    }, 0);
    const billDiscount = Number(this.purchaseForm.value.discountAmount || 0);
    return Math.max(0, itemTotal - billDiscount);
  }

  submitDraft(): void {
    if (!this.canMutatePurchase) {
      this.snackBar.open("You do not have permission to create purchase", "Close", { duration: 2500 });
      return;
    }

    if (this.purchaseForm.invalid || this.saving) {
      this.purchaseForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const req$ = this.editingPurchaseId
      ? this.purchaseService.updateDraft(this.editingPurchaseId, this.purchaseForm.value)
      : this.purchaseService.createDraft(this.purchaseForm.value);

    req$.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(
          this.editingPurchaseId ? "Purchase draft updated" : "Purchase draft created",
          "Close",
          { duration: 2500 },
        );
        this.resetForm();
        this.loadPurchases();
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(err?.error?.message || "Failed to create purchase draft", "Close", {
          duration: 3000,
        });
      },
    });
  }

  confirmPurchase(id: string): void {
    const purchase = this.purchases.find((p: any) => p?._id === id) || null;
    const invoice = purchase?.invoiceNo || id;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: "460px",
      maxWidth: "95vw",
      disableClose: true,
      data: {
        mode: "confirm",
        title: "Confirm Purchase",
        message: `Confirm purchase "${invoice}"? This will update stock and distributor ledger.`,
        confirmText: "Confirm",
        cancelText: "Cancel",
      } as ConfirmDialogData,
    });

    ref.afterClosed().subscribe((ok: boolean) => {
      if (!ok) return;
      this.executeConfirmPurchase(id);
    });
  }

  private executeConfirmPurchase(id: string): void {
    if (!this.canMutatePurchase || this.confirmingIds[id]) return;
    this.confirmingIds[id] = true;

    this.purchaseService.confirmPurchase(id).subscribe({
      next: () => {
        this.confirmingIds[id] = false;
        this.snackBar.open("Purchase confirmed and stock updated", "Close", { duration: 2800 });
        if (this.selectedPurchase?._id === id) {
          this.openDetails(id);
        }
        this.loadPurchases();
      },
      error: (err) => {
        this.confirmingIds[id] = false;
        this.snackBar.open(err?.error?.message || "Failed to confirm purchase", "Close", { duration: 3000 });
      },
    });
  }

  openDetails(id: string): void {
    this.purchaseService.getPurchaseById(id).subscribe({
      next: (res: any) => {
        this.selectedPurchase = res?.data || null;
        this.drawerOpen = !!this.selectedPurchase;
        const purchaseId = `${this.selectedPurchase?._id || id || ""}`;
        if (purchaseId) {
          this.loadPurchaseReturns(purchaseId);
        }
      },
      error: () => {
        this.snackBar.open("Failed to load purchase details", "Close", { duration: 2500 });
      },
    });
  }

  openDetailsByReference(): void {
    const ref = `${this.detailInvoiceRef || ""}`.trim();
    if (!ref) {
      this.snackBar.open("Enter invoice no or purchase id", "Close", { duration: 2200 });
      return;
    }
    this.openDetails(ref);
  }

  closeDrawer(): void {
    this.drawerOpen = false;
    this.purchaseReturns = [];
    this.purchaseReturnSummary = null;
  }

  getPaymentModeLabel(purchase: any): string {
    const resolved = `${purchase?.paymentMethodResolved || purchase?.paymentMethod || ""}`
      .trim()
      .toUpperCase();
    return resolved || "-";
  }

  getReturnStatusLabel(purchase: any): string {
    const status = `${purchase?.returnStatus || "NONE"}`.trim().toUpperCase();
    if (status === "FULL") return "FULL";
    if (status === "PARTIAL") return "PARTIAL";
    return "NONE";
  }

  openReturnDialog(purchaseId: string): void {
    if (!this.canMutatePurchase) return;
    const row = this.purchases.find((p: any) => `${p?._id}` === `${purchaseId}`);
    if ((row?.returnStatus || "NONE") === "FULL") {
      this.snackBar.open("All quantities already returned for this purchase", "Close", {
        duration: 2800,
      });
      return;
    }
    this.purchaseService.getPurchaseById(purchaseId).subscribe({
      next: (res: any) => {
        const purchase = res?.data;
        if (!purchase) return;

        const ref = this.dialog.open(PurchaseReturnDialogComponent, {
          width: "880px",
          maxWidth: "96vw",
          disableClose: true,
          data: { purchase },
        });

        ref.afterClosed().subscribe((ok: boolean) => {
          if (!ok) return;
          this.loadPurchases();
          if (this.selectedPurchase?._id === purchaseId) {
            this.openDetails(purchaseId);
          }
        });
      },
      error: () => {
        this.snackBar.open("Failed to load purchase for return", "Close", { duration: 2800 });
      },
    });
  }

  editDraft(purchase: any): void {
    if (!purchase || purchase.status !== "DRAFT") return;
    if (this.hasUnsavedChangesForEdit(purchase._id)) {
      const ref = this.dialog.open(ConfirmDialogComponent, {
        width: "460px",
        maxWidth: "95vw",
        disableClose: true,
        data: {
          mode: "confirm",
          title: "Unsaved Changes",
          message:
            "You have unsaved changes in the current purchase form. Discard and open selected draft?",
          confirmText: "Discard & Open",
          cancelText: "Stay Here",
        } as ConfirmDialogData,
      });

      ref.afterClosed().subscribe((ok: boolean) => {
        if (!ok) return;
        this.loadDraftIntoForm(purchase);
      });
      return;
    }

    this.loadDraftIntoForm(purchase);
  }

  cancelDraft(id: string): void {
    const purchase = this.purchases.find((p: any) => p?._id === id) || null;
    const invoice = purchase?.invoiceNo || id;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: "460px",
      maxWidth: "95vw",
      disableClose: true,
      data: {
        mode: "confirm",
        title: "Cancel Draft",
        message: `Cancel draft "${invoice}"? You can no longer confirm this draft after cancel.`,
        confirmText: "Cancel Draft",
        cancelText: "Keep Draft",
      } as ConfirmDialogData,
    });

    ref.afterClosed().subscribe((ok: boolean) => {
      if (!ok) return;
      this.executeCancelDraft(id);
    });
  }

  private executeCancelDraft(id: string): void {
    if (this.cancelingIds[id]) return;
    this.cancelingIds[id] = true;
    this.purchaseService.cancelDraft(id).subscribe({
      next: () => {
        this.cancelingIds[id] = false;
        this.snackBar.open("Draft cancelled", "Close", { duration: 2500 });
        if (this.editingPurchaseId === id) {
          this.resetForm();
        }
        if (this.selectedPurchase?._id === id) {
          this.openDetails(id);
        }
        this.loadPurchases();
      },
      error: (err) => {
        this.cancelingIds[id] = false;
        this.snackBar.open(err?.error?.message || "Failed to cancel draft", "Close", { duration: 3000 });
      },
    });
  }

  resetForm(): void {
    this.editingPurchaseId = null;
    this.purchaseForm.patchValue({
      distributor: null,
      invoiceNo: "",
      purchaseDate: new Date(),
      discountAmount: 0,
      paidAmount: 0,
      paymentMethod: "CASH",
      note: "",
    });
    this.purchaseForm.setControl("items", this.fb.array([this.createItemRow()]));
    this.rowModelsByIndex = {};
    this.rowVariationsByIndex = {};
    this.purchaseForm.markAsPristine();
    this.purchaseForm.markAsUntouched();
  }

  private hasUnsavedChangesForEdit(nextPurchaseId: string): boolean {
    const switchingDraft = !!this.editingPurchaseId && this.editingPurchaseId !== nextPurchaseId;
    return this.purchaseForm.dirty && (switchingDraft || !this.editingPurchaseId);
  }

  private loadDraftIntoForm(purchase: any): void {
    this.editingPurchaseId = purchase._id;
    this.purchaseForm.patchValue({
      distributor: purchase.distributor?._id || purchase.distributor || null,
      invoiceNo: purchase.invoiceNo || "",
      purchaseDate: purchase.purchaseDate ? new Date(purchase.purchaseDate) : new Date(),
      discountAmount: Number(purchase.discountAmount || 0),
      paidAmount: Number(purchase.paidAmount || 0),
      paymentMethod: purchase.paymentMethod || "CASH",
      note: purchase.note || "",
    });

    const rows = (purchase.items || []).map((it: any) =>
      this.fb.group({
        variation: [it.variation, Validators.required],
        product: [it.product, Validators.required],
        model: [it.model, Validators.required],
        sku: [it.sku, Validators.required],
        quantity: [Number(it.quantity || 1), [Validators.required, Validators.min(1)]],
        freeQuantity: [Number(it.freeQuantity || 0), [Validators.min(0)]],
        purchasePrice: [Number(it.purchasePrice || 0), [Validators.required, Validators.min(0)]],
        taxPercent: [Number(it.taxPercent || 0), [Validators.min(0)]],
        discountAmount: [Number(it.discountAmount || 0), [Validators.min(0)]],
      }),
    );
    this.purchaseForm.setControl("items", this.fb.array(rows.length ? rows : [this.createItemRow()]));
    this.rebuildAllRowOptionCaches();
    this.purchaseForm.markAsPristine();
    this.purchaseForm.markAsUntouched();
  }

  private rebuildAllRowOptionCaches(): void {
    this.rowModelsByIndex = {};
    this.rowVariationsByIndex = {};

    for (let i = 0; i < this.itemsFormArray.length; i += 1) {
      const row = this.itemsFormArray.at(i);
      const productId = `${row?.value?.product || ""}`;
      const modelId = `${row?.value?.model || ""}`;
      this.rowModelsByIndex[i] = this.buildModelsForProduct(productId);
      this.rowVariationsByIndex[i] = this.buildVariations(productId, modelId);
    }
  }

  private buildModelsForProduct(productId: string): any[] {
    if (!productId) return [];
    const product = this.products.find((p: any) => `${p?._id}` === `${productId}`);
    if (!product) return [];

    const modelMap = new Map<string, any>();
    (product.variations || []).forEach((v: any) => {
      const model = v?.model;
      const modelId = `${model?._id || model || ""}`;
      if (!modelId || modelMap.has(modelId)) return;
      modelMap.set(modelId, {
        _id: modelId,
        name: model?.name || "Model",
      });
    });

    return Array.from(modelMap.values());
  }

  private buildVariations(productId: string, modelId: string): any[] {
    if (!productId || !modelId) return [];
    const product = this.products.find((p: any) => `${p?._id}` === `${productId}`);
    if (!product) return [];

    return (product.variations || []).filter((v: any) => {
      const vModelId = `${v?.model?._id || v?.model || ""}`;
      return vModelId === `${modelId}`;
    });
  }

  private loadPurchaseReturns(purchaseId: string): void {
    this.purchaseService.listPurchaseReturns(purchaseId).subscribe({
      next: (res: any) => {
        this.purchaseReturns = Array.isArray(res?.data) ? res.data : [];
        this.purchaseReturnSummary = res?.summary || null;
      },
      error: () => {
        this.purchaseReturns = [];
        this.purchaseReturnSummary = null;
      },
    });
  }

  private formatDateForApi(d: Date): string {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = `${dt.getMonth() + 1}`.padStart(2, "0");
    const dd = `${dt.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}
