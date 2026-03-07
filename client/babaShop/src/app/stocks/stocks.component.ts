import { Component, OnInit } from "@angular/core";
import { PageEvent } from "@angular/material/paginator";
import { StocksService } from "app/shared/services/stocks.service";
import { AuthService } from "app/shared/services/auth.service";
import { Router } from "@angular/router";
import { ProductService } from "app/shared/services/product.service";
import { MatSnackBar } from "@angular/material/snack-bar";
import { DistributorService } from "app/shared/services/distributor.service";
import { PurchaseService } from "app/shared/services/purchase.service";
import { firstValueFrom } from "rxjs";
import { MatDialog } from "@angular/material/dialog";
import { StockReorderPreviewDialogComponent } from "./stock-reorder-preview-dialog.component";

@Component({
  selector: "stocks",
  templateUrl: "./stocks.component.html",
  styleUrls: ["./stocks.component.css"],
})
export class StocksComponent implements OnInit {
  loading = false;
  isSuperAdmin = false;
  currentScopeLabel = "Shop Wise";

  rows: any[] = [];
  totalItems = 0;

  page = 1;
  pageSize = 20;
  pageSizeOptions: number[] = [10, 20, 50, 100];

  search = "";
  lowStockOnly = false;
  sortBy = "updatedAt";
  order: "asc" | "desc" = "desc";

  summary: any = {
    totalQuantity: 0,
    totalReserved: 0,
    totalDamaged: 0,
    totalCostValue: 0,
    lowStockCount: 0,
  };

  txLoading = false;
  txRows: any[] = [];
  txTotalItems = 0;
  txPage = 1;
  txPageSize = 10;
  txPageSizeOptions: number[] = [10, 20, 50, 100];
  txFilters: {
    search: string;
    type: string | null;
    referenceType: string | null;
  } = {
    search: "",
    type: null,
    referenceType: null,
  };

  products: any[] = [];
  distributors: any[] = [];
  reorderDistributorId: string | null = null;
  reorderingIds: Record<string, boolean> = {};
  bulkReorderSaving = false;
  adjustSaving = false;
  adjustModelOptions: any[] = [];
  adjustVariationOptions: any[] = [];
  adjustForm: {
    product: string | null;
    model: string | null;
    variation: string | null;
    type: "IN" | "OUT" | "ADJUSTMENT";
    quantity: number | null;
    note: string;
  } = {
    product: null,
    model: null,
    variation: null,
    type: "ADJUSTMENT",
    quantity: null,
    note: "",
  };

  reconciliationLoading = false;
  reconciliationSaving = false;
  reconciliationSubmitting = false;
  reconciliationApproving = false;
  reconciliationMonthKey = this.getCurrentMonthKey();
  reconciliationSearch = "";
  reconciliation: any = null;

  constructor(
    private stocksService: StocksService,
    public authService: AuthService,
    private productService: ProductService,
    private distributorService: DistributorService,
    private purchaseService: PurchaseService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser() || {};
    this.isSuperAdmin = user?.role === "SUPER_ADMIN";
    this.currentScopeLabel =
      this.isSuperAdmin && !user?.shop ? "Global (All Shops)" : "Shop Wise";

    this.loadStocks();
    this.loadTransactions();
    this.loadProductsForAdjust();
    this.loadDistributorsForReorder();
    this.loadCurrentReconciliation();
  }

  get canAdjustStock(): boolean {
    const role = this.authService.getUserRole();
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role || "") && !this.authService.isGlobalReadOnlyMode();
  }

  get canViewSensitivePricing(): boolean {
    return this.authService.canViewSensitivePricing();
  }

  get canManagePurchases(): boolean {
    const role = this.authService.getUserRole();
    return ["SUPER_ADMIN", "ADMIN"].includes(role || "") && !this.authService.isGlobalReadOnlyMode();
  }

  get canCreateReorderDraft(): boolean {
    const role = this.authService.getUserRole();
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role || "") && !this.authService.isGlobalReadOnlyMode();
  }

  get canManageReconciliation(): boolean {
    const role = this.authService.getUserRole();
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(role || "") && !this.authService.isGlobalReadOnlyMode();
  }

  get canApproveReconciliation(): boolean {
    const role = this.authService.getUserRole();
    return ["SUPER_ADMIN", "ADMIN"].includes(role || "") && !this.authService.isGlobalReadOnlyMode();
  }

  get filteredReconciliationLines(): any[] {
    const lines = Array.isArray(this.reconciliation?.lines) ? this.reconciliation.lines : [];
    const term = `${this.reconciliationSearch || ""}`.trim().toLowerCase();
    if (!term) return lines;
    return lines.filter((line: any) => {
      const sku = `${line?.sku || ""}`.toLowerCase();
      const productName = `${line?.productName || ""}`.toLowerCase();
      const modelName = `${line?.modelName || ""}`.toLowerCase();
      return sku.includes(term) || productName.includes(term) || modelName.includes(term);
    });
  }

  onReconciliationMonthChange(): void {
    this.loadCurrentReconciliation();
  }

  loadCurrentReconciliation(): void {
    this.reconciliationLoading = true;
    this.stocksService.getCurrentReconciliation(this.reconciliationMonthKey).subscribe({
      next: (res: any) => {
        this.reconciliation = res?.data || null;
        this.reconciliationLoading = false;
      },
      error: () => {
        this.reconciliation = null;
        this.reconciliationLoading = false;
      },
    });
  }

  startReconciliation(): void {
    if (!this.canManageReconciliation || this.reconciliationSaving) return;
    this.reconciliationSaving = true;
    this.stocksService.startReconciliation(this.reconciliationMonthKey).subscribe({
      next: (res: any) => {
        this.reconciliationSaving = false;
        this.reconciliation = res?.data || null;
        this.snackBar.open(res?.message || "Reconciliation started", "Close", { duration: 2600 });
      },
      error: (err: any) => {
        this.reconciliationSaving = false;
        this.snackBar.open(err?.error?.message || "Failed to start reconciliation", "Close", {
          duration: 3000,
        });
      },
    });
  }

  onCountedQtyChange(line: any): void {
    const counted = Math.max(0, Number(line?.countedQty || 0));
    const system = Number(line?.systemQty || 0);
    line.countedQty = counted;
    line.varianceQty = counted - system;
    this.refreshReconciliationSummary();
  }

  saveReconciliationDraft(): void {
    if (!this.canManageReconciliation || this.reconciliationSaving) return;
    if (!this.reconciliation?._id) {
      this.snackBar.open("Start reconciliation first", "Close", { duration: 2400 });
      return;
    }
    if (`${this.reconciliation?.status || ""}` !== "DRAFT") {
      this.snackBar.open("Only draft reconciliation can be saved", "Close", { duration: 2400 });
      return;
    }

    const lines = (this.reconciliation?.lines || []).map((line: any) => ({
      variation: line?.variation,
      countedQty: Number(line?.countedQty || 0),
      note: line?.note || "",
    }));

    this.reconciliationSaving = true;
    this.stocksService.saveReconciliationLines(this.reconciliation._id, lines).subscribe({
      next: (res: any) => {
        this.reconciliationSaving = false;
        this.reconciliation = res?.data || this.reconciliation;
        this.snackBar.open("Reconciliation draft saved", "Close", { duration: 2400 });
      },
      error: (err: any) => {
        this.reconciliationSaving = false;
        this.snackBar.open(err?.error?.message || "Failed to save reconciliation", "Close", {
          duration: 3000,
        });
      },
    });
  }

  submitReconciliation(): void {
    if (!this.canManageReconciliation || this.reconciliationSubmitting) return;
    if (!this.reconciliation?._id) return;
    this.reconciliationSubmitting = true;
    this.stocksService.submitReconciliation(this.reconciliation._id).subscribe({
      next: (res: any) => {
        this.reconciliationSubmitting = false;
        this.reconciliation = res?.data || this.reconciliation;
        this.snackBar.open("Reconciliation submitted", "Close", { duration: 2500 });
      },
      error: (err: any) => {
        this.reconciliationSubmitting = false;
        this.snackBar.open(err?.error?.message || "Failed to submit reconciliation", "Close", {
          duration: 3000,
        });
      },
    });
  }

  approveReconciliation(): void {
    if (!this.canApproveReconciliation || this.reconciliationApproving) return;
    if (!this.reconciliation?._id) return;
    this.reconciliationApproving = true;
    this.stocksService.approveReconciliation(this.reconciliation._id).subscribe({
      next: (res: any) => {
        this.reconciliationApproving = false;
        this.reconciliation = res?.data || this.reconciliation;
        this.snackBar.open("Reconciliation approved and stock updated", "Close", {
          duration: 2800,
        });
        this.loadStocks();
        this.loadTransactions();
      },
      error: (err: any) => {
        this.reconciliationApproving = false;
        this.snackBar.open(err?.error?.message || "Failed to approve reconciliation", "Close", {
          duration: 3200,
        });
      },
    });
  }

  loadStocks(): void {
    this.loading = true;

    const params: any = {
      page: this.page,
      limit: this.pageSize,
      search: this.search?.trim() || "",
      lowStock: this.lowStockOnly,
      sortBy: this.sortBy,
      order: this.order,
    };

    this.stocksService.getStocks(params).subscribe({
      next: (res: any) => {
        this.rows = Array.isArray(res?.stockReport) ? res.stockReport : [];
        this.totalItems = Number(res?.total || 0);
        this.summary = {
          totalQuantity: Number(res?.summary?.totalQuantity || 0),
          totalReserved: Number(res?.summary?.totalReserved || 0),
          totalDamaged: Number(res?.summary?.totalDamaged || 0),
          totalCostValue: Number(res?.summary?.totalCostValue || 0),
          lowStockCount: Number(res?.summary?.lowStockCount || 0),
        };
        this.loading = false;
      },
      error: () => {
        this.rows = [];
        this.totalItems = 0;
        this.loading = false;
      },
    });
  }

  onSearch(): void {
    this.page = 1;
    this.loadStocks();
  }

  onClear(): void {
    this.search = "";
    this.lowStockOnly = false;
    this.sortBy = "updatedAt";
    this.order = "desc";
    this.page = 1;
    this.loadStocks();
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadStocks();
  }

  loadTransactions(): void {
    this.txLoading = true;

    const params: any = {
      page: this.txPage,
      limit: this.txPageSize,
      search: this.txFilters.search?.trim() || "",
      type: this.txFilters.type || undefined,
      referenceType: this.txFilters.referenceType || undefined,
    };

    this.stocksService.getTransactions(params).subscribe({
      next: (res: any) => {
        this.txRows = Array.isArray(res?.data) ? res.data : [];
        this.txTotalItems = Number(res?.total || 0);
        this.txLoading = false;
      },
      error: () => {
        this.txRows = [];
        this.txTotalItems = 0;
        this.txLoading = false;
      },
    });
  }

  onTxApply(): void {
    this.txPage = 1;
    this.loadTransactions();
  }

  onTxReset(): void {
    this.txFilters = {
      search: "",
      type: null,
      referenceType: null,
    };
    this.txPage = 1;
    this.loadTransactions();
  }

  onTxPageChange(event: PageEvent): void {
    this.txPage = event.pageIndex + 1;
    this.txPageSize = event.pageSize;
    this.loadTransactions();
  }

  loadProductsForAdjust(): void {
    this.productService.getAllProducts().subscribe({
      next: (res: any) => {
        this.products = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      },
      error: () => {
        this.products = [];
      },
    });
  }

  loadDistributorsForReorder(): void {
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
        this.distributors = [];
      },
    });
  }

  onAdjustProductChange(): void {
    this.adjustForm.model = null;
    this.adjustForm.variation = null;
    this.adjustVariationOptions = [];

    const product = this.products.find((p: any) => `${p?._id}` === `${this.adjustForm.product}`);
    const map = new Map<string, any>();
    (product?.variations || []).forEach((v: any) => {
      const modelId = `${v?.model?._id || v?.model || ""}`;
      if (!modelId || map.has(modelId)) return;
      map.set(modelId, {
        _id: modelId,
        name: v?.model?.name || "Model",
      });
    });
    this.adjustModelOptions = Array.from(map.values());
  }

  onAdjustModelChange(): void {
    this.adjustForm.variation = null;
    const product = this.products.find((p: any) => `${p?._id}` === `${this.adjustForm.product}`);

    this.adjustVariationOptions = (product?.variations || []).filter((v: any) => {
      const modelId = `${v?.model?._id || v?.model || ""}`;
      return modelId === `${this.adjustForm.model}`;
    });
  }

  submitAdjustment(): void {
    if (!this.canAdjustStock || this.adjustSaving) return;

    if (!this.adjustForm.variation || !this.adjustForm.type || this.adjustForm.quantity === null) {
      this.snackBar.open("Variation, type and quantity are required", "Close", { duration: 2600 });
      return;
    }
    if (Number(this.adjustForm.quantity) <= 0 && this.adjustForm.type !== "ADJUSTMENT") {
      this.snackBar.open("Quantity must be greater than 0", "Close", { duration: 2600 });
      return;
    }

    this.adjustSaving = true;
    this.stocksService.manualAdjust({
      variation: this.adjustForm.variation,
      type: this.adjustForm.type,
      quantity: Number(this.adjustForm.quantity || 0),
      note: this.adjustForm.note || "",
    }).subscribe({
      next: () => {
        this.adjustSaving = false;
        this.snackBar.open("Stock adjusted successfully", "Close", { duration: 2400 });
        this.adjustForm = {
          product: null,
          model: null,
          variation: null,
          type: "ADJUSTMENT",
          quantity: null,
          note: "",
        };
        this.adjustModelOptions = [];
        this.adjustVariationOptions = [];
        this.loadStocks();
        this.loadTransactions();
      },
      error: (err) => {
        this.adjustSaving = false;
        this.snackBar.open(err?.error?.message || "Failed to adjust stock", "Close", {
          duration: 3000,
        });
      },
    });
  }

  getSuggestedReorderQty(row: any): number {
    const reorder = Number(row?.reorderLevel || 0);
    const current = Number(row?.quantity || 0);
    const gap = reorder - current;
    return gap > 0 ? gap : 1;
  }

  createReorderDraft(row: any): void {
    if (!this.canCreateReorderDraft) return;

    if (!this.reorderDistributorId) {
      this.snackBar.open("Select distributor first for reorder", "Close", { duration: 2600 });
      return;
    }

    const variationId = row?.variation?._id || row?.variation;
    if (!variationId) {
      this.snackBar.open("Variation not found for selected stock row", "Close", { duration: 2600 });
      return;
    }

    const rowId = `${row?._id || variationId}`;
    if (this.reorderingIds[rowId]) return;
    this.reorderingIds[rowId] = true;

    const qty = this.getSuggestedReorderQty(row);
    const purchasePrice = Number(row?.lastPurchasePrice || 0);

    this.purchaseService.createDraft({
      distributor: this.reorderDistributorId,
      invoiceNo: "",
      purchaseDate: new Date(),
      discountAmount: 0,
      paidAmount: 0,
      paymentMethod: "CASH",
      note: `Auto reorder draft from low stock for SKU ${row?.sku || row?.variation?.sku || "-"}`,
      items: [
        {
          variation: variationId,
          quantity: qty,
          freeQuantity: 0,
          purchasePrice,
          taxPercent: 0,
          discountAmount: 0,
        },
      ],
    }).subscribe({
      next: () => {
        this.reorderingIds[rowId] = false;
        this.snackBar.open("Reorder purchase draft created", "Close", { duration: 2600 });
      },
      error: (err) => {
        this.reorderingIds[rowId] = false;
        this.snackBar.open(err?.error?.message || "Failed to create reorder draft", "Close", {
          duration: 3000,
        });
      },
    });
  }

  async createBulkReorderDrafts(): Promise<void> {
    if (!this.canCreateReorderDraft) return;
    if (this.bulkReorderSaving) return;

    if (!this.reorderDistributorId) {
      this.snackBar.open("Select distributor first for bulk reorder", "Close", { duration: 2600 });
      return;
    }

    const lowRows = this.rows.filter((r: any) => this.isLowStock(r));
    if (!lowRows.length) {
      this.snackBar.open("No low stock rows found for reorder", "Close", { duration: 2400 });
      return;
    }

    const previewRows = lowRows.map((row: any) => ({
      stockId: `${row?._id || row?.variation?._id || ""}`,
      productName: row?.product?.name || "-",
      modelName: row?.model?.name || "-",
      sku: row?.sku || row?.variation?.sku || "-",
      currentQty: Number(row?.quantity || 0),
      reorderLevel: Number(row?.reorderLevel || 0),
      suggestedQty: this.getSuggestedReorderQty(row),
      selected: true,
      variationId: row?.variation?._id || row?.variation,
      purchasePrice: Number(row?.lastPurchasePrice || 0),
    }));

    const ref = this.dialog.open(StockReorderPreviewDialogComponent, {
      width: "980px",
      maxWidth: "96vw",
      disableClose: true,
      data: { rows: previewRows },
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result?.confirmed) return;
    const selectedRows = Array.isArray(result?.rows) ? result.rows.filter((r: any) => r?.selected) : [];
    if (!selectedRows.length) {
      this.snackBar.open("No row selected for bulk reorder", "Close", { duration: 2400 });
      return;
    }

    this.bulkReorderSaving = true;
    let success = 0;
    let failed = 0;

    for (const row of selectedRows) {
      const variationId = row?.variationId;
      if (!variationId) {
        failed += 1;
        continue;
      }

      const rowId = `${row?.stockId || variationId}`;
      this.reorderingIds[rowId] = true;

      const qty = Math.max(1, Number(row?.suggestedQty || 1));
      const purchasePrice = Number(row?.purchasePrice || 0);

      try {
        await firstValueFrom(
          this.purchaseService.createDraft({
            distributor: this.reorderDistributorId,
            invoiceNo: "",
            purchaseDate: new Date(),
            discountAmount: 0,
            paidAmount: 0,
            paymentMethod: "CASH",
            note: `Auto bulk reorder draft from low stock for SKU ${row?.sku || "-"}`,
            items: [
              {
                variation: variationId,
                quantity: qty,
                freeQuantity: 0,
                purchasePrice,
                taxPercent: 0,
                discountAmount: 0,
              },
            ],
          }),
        );
        success += 1;
      } catch (e) {
        failed += 1;
      } finally {
        this.reorderingIds[rowId] = false;
      }
    }

    this.bulkReorderSaving = false;
    this.snackBar.open(`Bulk reorder done. Success: ${success}, Failed: ${failed}`, "Close", {
      duration: 3600,
    });
  }

  getAvailableQty(row: any): number {
    if (typeof row?.availableQuantity === "number") return Number(row.availableQuantity);
    const qty = Number(row?.quantity || 0);
    const reserved = Number(row?.reservedQuantity || 0);
    const damaged = Number(row?.damagedQuantity || 0);
    return Math.max(0, qty - reserved - damaged);
  }

  getStockValue(row: any): number {
    return Number(row?.quantity || 0) * Number(row?.lastPurchasePrice || 0);
  }

  isLowStock(row: any): boolean {
    return Number(row?.quantity || 0) <= Number(row?.reorderLevel || 0);
  }

  goToPurchase(): void {
    this.router.navigateByUrl("/purchase");
  }

  goToProducts(): void {
    this.router.navigateByUrl("/item-list");
  }

  exportStockCsv(): void {
    if (!this.rows.length) {
      this.snackBar.open("No stock rows to export", "Close", { duration: 2200 });
      return;
    }

    const headers = [
      "Product",
      "Model",
      "SKU",
      "Storage",
      "Color",
      "Size",
      "Quantity",
      "Reserved",
      "Damaged",
      "Available",
      "Reorder",
      "CostPrice",
      "StockValue",
      "Status",
    ];

    const lines = this.rows.map((row: any) => {
      const storage = row?.variation?.attributes?.storage || "";
      const color = row?.variation?.attributes?.color || "";
      const size = row?.variation?.attributes?.size || "";
      return [
        row?.product?.name || "",
        row?.model?.name || "",
        row?.sku || row?.variation?.sku || "",
        storage,
        color,
        size,
        Number(row?.quantity || 0),
        Number(row?.reservedQuantity || 0),
        Number(row?.damagedQuantity || 0),
        this.getAvailableQty(row),
        Number(row?.reorderLevel || 0),
        Number(row?.lastPurchasePrice || 0),
        this.getStockValue(row),
        this.isLowStock(row) ? "LOW" : "OK",
      ];
    });

    this.downloadCsv("stock-report", headers, lines);
  }

  exportTransactionsCsv(): void {
    if (!this.txRows.length) {
      this.snackBar.open("No transactions to export", "Close", { duration: 2200 });
      return;
    }

    const headers = [
      "DateTime",
      "SKU",
      "Product",
      "Model",
      "Type",
      "ReferenceType",
      "ReferenceId",
      "Quantity",
      "DeltaQuantity",
      "PreviousQuantity",
      "NewQuantity",
      "CreatedBy",
      "Note",
    ];

    const lines = this.txRows.map((tx: any) => [
      tx?.createdAt ? new Date(tx.createdAt).toISOString() : "",
      tx?.sku || "",
      tx?.product?.name || "",
      tx?.model?.name || "",
      tx?.type || "",
      tx?.referenceType || "",
      tx?.referenceId || "",
      Number(tx?.quantity || 0),
      Number(tx?.deltaQuantity || 0),
      Number(tx?.previousQuantity || 0),
      Number(tx?.newQuantity || 0),
      tx?.createdBy?.email || "",
      tx?.note || "",
    ]);

    this.downloadCsv("stock-transactions", headers, lines);
  }

  private downloadCsv(prefix: string, headers: string[], rows: any[][]): void {
    const escape = (value: any): string => {
      const raw = `${value ?? ""}`;
      const safe = raw.replace(/"/g, "\"\"");
      return `"${safe}"`;
    };
    const content = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `${prefix}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private refreshReconciliationSummary(): void {
    const lines = Array.isArray(this.reconciliation?.lines) ? this.reconciliation.lines : [];
    const totalLines = lines.length;
    const matchedLines = lines.filter((l: any) => Number(l?.varianceQty || 0) === 0).length;
    const mismatchLines = totalLines - matchedLines;
    const totalSystemQty = lines.reduce((acc: number, l: any) => acc + Number(l?.systemQty || 0), 0);
    const totalCountedQty = lines.reduce((acc: number, l: any) => acc + Number(l?.countedQty || 0), 0);
    const totalVarianceQty = lines.reduce((acc: number, l: any) => acc + Number(l?.varianceQty || 0), 0);
    this.reconciliation.summary = {
      totalLines,
      matchedLines,
      mismatchLines,
      totalSystemQty,
      totalCountedQty,
      totalVarianceQty,
    };
  }

  private getCurrentMonthKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
  }
}
