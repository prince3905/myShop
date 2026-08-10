import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { ShopService } from "app/shared/services/shop.service";
import { StaffDailyWorkService } from "app/shared/services/staff-daily-work.service";

@Component({
  selector: "app-factory-verification",
  templateUrl: "./factory-verification.component.html",
  styleUrls: ["./factory-verification.component.css"],
})
export class FactoryVerificationComponent implements OnInit {
  filters = {
    search: "",
    verificationStatus: "",
    dateFrom: "",
    dateTo: "",
  };

  loading = false;
  actingId: string | null = null;
  rows: any[] = [];
  pushHistoryRows: any[] = [];
  targetShopOptions: any[] = [];
  selectedTargetShopByRow: Record<string, string> = {};
  summary = {
    pending: 0,
    approved: 0,
    partial: 0,
    rejected: 0,
  };

  constructor(
    private staffDailyWorkService: StaffDailyWorkService,
    private shopService: ShopService,
    public authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  get canViewSensitivePricing(): boolean {
    return this.authService.canViewSensitivePricing();
  }

  get currentShopId(): string {
    return this.authService.getShopId() || "";
  }

  get filteredTargetShopOptions(): any[] {
    return this.targetShopOptions;
  }

  get factoryPendingRows(): any[] {
    return this.rows.filter((row: any) =>
      row?.stockPushStatus !== "PUSHED" &&
      ["APPROVED", "PARTIAL"].includes(`${row?.verificationStatus || ""}`) &&
      Number(row?.verifiedQty || 0) > 0
    );
  }

  get factoryPendingQty(): number {
    return this.factoryPendingRows.reduce((sum: number, row: any) => sum + Number(row?.verifiedQty || 0), 0);
  }

  get readyToPushCount(): number {
    return this.factoryPendingRows.length;
  }

  getVariationLabel(item: any): string {
    if (!item) return "";
    const fp = item?.factoryProduct || item;
    const variation = fp?.shopVariation || item?.shopVariation;

    const sku = item?.factoryProductSku || fp?.code || variation?.sku || "";
    const size = fp?.variationSize || variation?.attributes?.size || "";
    const color = fp?.variationColor || variation?.attributes?.color || "";
    const modelName = fp?.shopModel?.name || variation?.model?.name || "";

    const parts: string[] = [];
    if (modelName && modelName.toUpperCase() !== (fp?.name || "").toUpperCase()) {
      parts.push(modelName);
    }
    if (size) {
      parts.push(size);
    }
    if (color && !["NONE", "NETURAL", "NATURAL"].includes(color.toUpperCase())) {
      parts.push(color);
    }
    if (sku) {
      parts.push(sku);
    }

    return parts.join(" · ");
  }

  get productWiseFactoryPending(): any[] {
    const grouped = new Map<string, any>();

    this.factoryPendingRows.forEach((row: any) => {
      const key = `${row?.factoryProduct?._id || row?.factoryProduct || row?._id}`;
      const varLabel = this.getVariationLabel(row);
      const existing = grouped.get(key) || {
        key,
        productName: row?.factoryProductName || row?.factoryProduct?.name || "-",
        variationLabel: varLabel,
        unit: row?.unit || row?.factoryProduct?.unitLabel || "PCS",
        qty: 0,
        entries: 0,
        lastProductionDate: row?.entryDate || null,
      };

      existing.qty += Number(row?.verifiedQty || 0);
      existing.entries += 1;

      if (!existing.lastProductionDate || new Date(row?.entryDate || 0) > new Date(existing.lastProductionDate || 0)) {
        existing.lastProductionDate = row?.entryDate || existing.lastProductionDate;
      }

      grouped.set(key, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => {
      if (b.qty !== a.qty) {
        return b.qty - a.qty;
      }
      return `${a.productName}`.localeCompare(`${b.productName}`);
    });
  }

  ngOnInit(): void {
    this.loadTargetShops();
    this.loadRows();
    this.loadPushHistory();
  }

  loadRows(): void {
    this.loading = true;
    this.staffDailyWorkService.getDailyWorks({
      ...this.filters,
      verificationStatus: this.filters.verificationStatus || "",
    }).subscribe({
      next: (response) => {
        this.rows = (response?.dailyWorks || []).filter(
          (row: any) => !!row?.factoryProduct && Number(row?.unitsCompleted || 0) > 0
        );
        this.rows.forEach((row: any) => this.ensureTargetShopSelection(row));
        this.summary = this.buildSummary(this.rows);
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || "Failed to load verification list", "Close", { duration: 2500 });
      },
    });
  }

  resetFilters(): void {
    this.filters = {
      search: "",
      verificationStatus: "",
      dateFrom: "",
      dateTo: "",
    };
    this.loadRows();
  }

  showAll(): void {
    this.filters.verificationStatus = "";
    this.loadRows();
  }

  showStatus(status: string): void {
    this.filters.verificationStatus = status;
    this.loadRows();
  }

  approve(row: any): void {
    this.runVerification(row, {
      verificationStatus: "APPROVED",
      verifiedQty: Number(row?.unitsCompleted || 0),
      verificationNote: "",
    });
  }

  partialApprove(row: any): void {
    const defaultQty = Number(row?.unitsCompleted || 0);
    const entered = window.prompt(`Kitna qty approve karna hai? Max ${defaultQty}`, `${defaultQty}`);
    if (entered === null) {
      return;
    }
    const verifiedQty = Number(entered);
    const note = window.prompt("Partial approve note (optional)", row?.verificationNote || "") || "";
    this.runVerification(row, {
      verificationStatus: verifiedQty >= defaultQty ? "APPROVED" : "PARTIAL",
      verifiedQty,
      verificationNote: note,
    });
  }

  reject(row: any): void {
    const note = window.prompt("Reject reason / note", row?.verificationNote || "");
    if (note === null) {
      return;
    }
    this.runVerification(row, {
      verificationStatus: "REJECTED",
      verifiedQty: 0,
      verificationNote: note,
    });
  }

  pushToShop(row: any): void {
    if (!row?._id || this.actingId) {
      return;
    }
    const targetShopId = this.selectedTargetShopByRow[row._id] || "";
    const targetShop = this.targetShopOptions.find((item: any) => item?._id === targetShopId);
    if (!targetShopId) {
      this.snackBar.open("Target shop select karo", "Close", { duration: 2500 });
      return;
    }
    const confirmed = window.confirm(
      `Verified qty ko ${targetShop?.shopCode || targetShop?.name || "selected shop"} me push karna hai?\n\n${row?.factoryProductName || row?.factoryProduct?.name || "Factory Product"}`
    );
    if (!confirmed) {
      return;
    }
    this.actingId = row._id;
    this.staffDailyWorkService.pushDailyWorkToStock(row._id, { targetShop: targetShopId }).subscribe({
      next: (response) => {
        this.actingId = null;
        this.snackBar.open(response?.message || "Shop stock updated", "Close", { duration: 2500 });
        this.loadRows();
        this.loadPushHistory();
      },
      error: (error) => {
        this.actingId = null;
        this.snackBar.open(error?.error?.message || "Failed to push stock", "Close", { duration: 3000 });
      },
    });
  }

  getMaterialCost(row: any): number {
    const qty = Number(row?.unitsCompleted || 0);
    return (row?.factoryProduct?.standardMaterialLines || []).reduce((sum: number, line: any) => {
      return sum + (Number(line?.qtyPerUnit || 0) * qty * Number(line?.rate || 0));
    }, 0);
  }

  getActualBoxCost(row: any): number {
    const qty = Number(row?.unitsCompleted || 0);
    if (qty <= 0) {
      return 0;
    }
    const materialCost = this.getMaterialCost(row);
    const workerCost = Number(row?.earnedAmount || 0);
    return (materialCost + workerCost) / qty;
  }

  getShopSellingPrice(row: any): number {
    const variationPrice = Number(row?.factoryProduct?.shopVariation?.sellingPrice || 0);
    if (variationPrice > 0) {
      return variationPrice;
    }
    return Number(row?.factoryProduct?.defaultSellingPrice || 0);
  }

  getDisplayedCostPrice(row: any): number {
    const currentShopCost = Number(row?.factoryProduct?.shopVariation?.costPrice || 0);
    if (currentShopCost > 0) {
      return currentShopCost;
    }
    return this.getActualBoxCost(row);
  }

  getMaterialPreview(row: any): string {
    const qty = Number(row?.unitsCompleted || 0);
    return (row?.factoryProduct?.standardMaterialLines || [])
      .map((line: any) => {
        const used = Number(line?.qtyPerUnit || 0) * qty;
        const label = `${line?.materialName || line?.rawMaterial?.name || "Material"}`.trim();
        const unit = `${line?.unitLabel || "PCS"}`.trim();
        return used > 0 ? `${label} ${used} ${unit}` : "";
      })
      .filter(Boolean)
      .join(" | ");
  }

  private runVerification(row: any, payload: any): void {
    if (!row?._id || this.actingId) {
      return;
    }
    this.actingId = row._id;
    this.staffDailyWorkService.verifyDailyWork(row._id, payload).subscribe({
      next: (response) => {
        this.actingId = null;
        this.snackBar.open(response?.message || "Verification updated", "Close", { duration: 2500 });
        this.loadRows();
      },
      error: (error) => {
        this.actingId = null;
        this.snackBar.open(error?.error?.message || "Failed to update verification", "Close", { duration: 3000 });
      },
    });
  }

  private buildSummary(rows: any[]): any {
    return {
      pending: rows.filter((row: any) => row?.verificationStatus === "PENDING").length,
      approved: rows.filter((row: any) => row?.verificationStatus === "APPROVED").length,
      partial: rows.filter((row: any) => row?.verificationStatus === "PARTIAL").length,
      rejected: rows.filter((row: any) => row?.verificationStatus === "REJECTED").length,
    };
  }

  private loadTargetShops(): void {
    this.shopService.getPushTargetShops().subscribe({
      next: (response) => {
        this.targetShopOptions = response?.data || [];
        this.rows.forEach((row) => this.ensureTargetShopSelection(row));
      },
      error: () => {
        this.targetShopOptions = [];
      },
    });
  }

  private loadPushHistory(): void {
    this.staffDailyWorkService.getPushHistory({}).subscribe({
      next: (response) => {
        this.pushHistoryRows = response?.rows || [];
      },
      error: () => {
        this.pushHistoryRows = [];
      },
    });
  }

  private ensureTargetShopSelection(row: any): void {
    if (!row?._id || this.selectedTargetShopByRow[row._id]) {
      return;
    }
    this.selectedTargetShopByRow[row._id] = row?.pushedToShop?._id || "";
  }

  getShopLabel(shop: any): string {
    if (!shop) {
      return "-";
    }
    const name = `${shop?.name || ""}`.trim();
    const code = `${shop?.shopCode || ""}`.trim();
    return code && name ? `${name} (${code})` : name || code || "-";
  }

  isSameShopPush(row: any): boolean {
    return `${row?.sourceShop?._id || ""}` !== "" && `${row?.sourceShop?._id || ""}` === `${row?.targetShop?._id || ""}`;
  }
}
