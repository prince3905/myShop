import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
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
  summary = {
    pending: 0,
    approved: 0,
    partial: 0,
    rejected: 0,
  };

  constructor(
    private staffDailyWorkService: StaffDailyWorkService,
    public authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  get canViewSensitivePricing(): boolean {
    return this.authService.canViewSensitivePricing();
  }

  ngOnInit(): void {
    this.loadRows();
  }

  loadRows(): void {
    this.loading = true;
    this.staffDailyWorkService.getDailyWorks({
      ...this.filters,
      verificationStatus: this.filters.verificationStatus || "",
    }).subscribe({
      next: (response) => {
        this.rows = (response?.dailyWorks || []).filter((row: any) => !!row?.factoryProduct);
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
    const confirmed = window.confirm(`Verified qty ko shop stock me push karna hai?\n\n${row?.factoryProductName || row?.factoryProduct?.name || "Factory Product"}`);
    if (!confirmed) {
      return;
    }
    this.actingId = row._id;
    this.staffDailyWorkService.pushDailyWorkToStock(row._id).subscribe({
      next: (response) => {
        this.actingId = null;
        this.snackBar.open(response?.message || "Shop stock updated", "Close", { duration: 2500 });
        this.loadRows();
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
}
