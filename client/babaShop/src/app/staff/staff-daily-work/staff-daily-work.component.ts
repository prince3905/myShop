import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { StaffDailyWorkService } from "app/shared/services/staff-daily-work.service";
import { StaffService } from "app/shared/services/staff.service";
import { FactoryProductService } from "app/shared/services/factory-product.service";
import { RawMaterialService } from "app/shared/services/raw-material.service";

@Component({
  selector: "app-staff-daily-work",
  templateUrl: "./staff-daily-work.component.html",
  styleUrls: ["./staff-daily-work.component.css"],
})
export class StaffDailyWorkComponent implements OnInit {
  readonly attendanceOptions = ["PRESENT", "HALF_DAY", "ABSENT"];
  showAdvanced = false;

  dailyWorkForm = {
    staff: "",
    entryDate: this.formatDate(new Date()),
    attendanceStatus: "PRESENT",
    workType: "",
    factoryProduct: "",
    factoryProductName: "",
    workItem: "",
    workItemName: "",
    unit: "PCS",
    pieceRate: 0,
    workDetails: "",
    linkedJob: "",
    unitsCompleted: 0,
    earnedAmount: 0,
    isKhorakiIncluded: false,
    khorakiAmount: 100,
    note: "",
  };

  filters = {
    search: "",
    staff: "",
    attendanceStatus: "",
    verificationStatus: "",
    dateFrom: "",
    dateTo: "",
  };

  summary: any = {
    totalEntries: 0,
    presentCount: 0,
    halfDayCount: 0,
    absentCount: 0,
    totalEarned: 0,
    totalUnitsCompleted: 0,
    byAttendance: [],
  };

  staffOptions: any[] = [];
  factoryProductOptions: any[] = [];
  rawMaterialOptions: any[] = [];
  dailyWorks: any[] = [];
  editingDailyWorkId: string | null = null;
  loadingStaffs = false;
  loadingSummary = false;
  loadingDailyWorks = false;
  savingDailyWork = false;
  deletingId: string | null = null;
  userRole: string | null = null;
  currentUserId: string | null = null;
  currentShopLabel = "-";
  activeTab: 'WORK' | 'KHORAKI' = 'WORK';

  get defaultKhorakiAmount(): number {
    const status = this.dailyWorkForm.attendanceStatus;
    if (status === "HALF_DAY") return 50;
    if (status === "ABSENT") return 0;
    return 100;
  }

  get productionWorkList(): any[] {
    return (this.dailyWorks || []).filter((dw: any) => {
      const isPureKhoraki = dw.isKhorakiIncluded && (!dw.unitsCompleted || dw.unitsCompleted === 0) && (!dw.earnedAmount || dw.earnedAmount === 0);
      return !isPureKhoraki;
    });
  }

  get khorakiList(): any[] {
    return (this.dailyWorks || []).filter((dw: any) => dw.isKhorakiIncluded === true || Number(dw.khorakiAmount || 0) > 0);
  }

  constructor(
    private staffService: StaffService,
    private factoryProductService: FactoryProductService,
    private rawMaterialService: RawMaterialService,
    private staffDailyWorkService: StaffDailyWorkService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    const user = this.authService.getCurrentUser();
    this.currentUserId = user?._id || null;
    this.currentShopLabel = user?.shopCode || user?.shop || "-";
    this.loadStaffs();
    this.loadFactoryProducts();
    this.loadRawMaterials();
    this.loadAll();
  }

  get canManage(): boolean {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${this.userRole || ""}`);
  }

  get canViewSensitivePricing(): boolean {
    return this.authService.canViewSensitivePricing();
  }

  canEditRow(dailyWork: any): boolean {
    if (!dailyWork?._id) {
      return false;
    }
    if (this.canManage) {
      return true;
    }
    return `${dailyWork?.createdBy?._id || dailyWork?.createdBy || ""}` === `${this.currentUserId || ""}`;
  }

  canDeleteRow(dailyWork: any): boolean {
    if (dailyWork?.stockPushStatus === "PUSHED") {
      return false;
    }
    return this.canManage && !!dailyWork?._id;
  }

  get earnedAmountPreview(): number {
    const staff = this.staffOptions.find((row) => row?._id === this.dailyWorkForm.staff);
    if (!staff) {
      return Number(this.dailyWorkForm.earnedAmount || 0);
    }
    const rate = Number(staff?.rate || 0);
    if (`${staff?.rateType || ""}` === "PIECE") {
      const pieceRate = Number(this.selectedFactoryProduct?.workerPieceRate || this.dailyWorkForm.pieceRate || rate || 0);
      return pieceRate * Number(this.dailyWorkForm.unitsCompleted || 0);
    }
    if (`${staff?.rateType || ""}` === "MONTHLY") {
      if (this.dailyWorkForm.attendanceStatus === "ABSENT") {
        return 0;
      }
      const perDay = rate / 30;
      return this.dailyWorkForm.attendanceStatus === "HALF_DAY" ? perDay / 2 : perDay;
    }
    if (this.dailyWorkForm.attendanceStatus === "HALF_DAY") {
      return rate / 2;
    }
    if (this.dailyWorkForm.attendanceStatus === "ABSENT") {
      return 0;
    }
    return rate;
  }

  get selectedFactoryProduct(): any | null {
    return this.factoryProductOptions.find((row) => row?._id === this.dailyWorkForm.factoryProduct) || null;
  }

  get selectedStaff(): any | null {
    return this.staffOptions.find((row) => row?._id === this.dailyWorkForm.staff) || null;
  }

  get isPieceRateStaff(): boolean {
    return `${this.selectedStaff?.rateType || ""}` === "PIECE";
  }

  get materialRequirementPreview(): any[] {
    const product = this.selectedFactoryProduct;
    const qty = Number(this.dailyWorkForm.unitsCompleted || 0);
    const lines = product?.standardMaterialLines || [];
    if (!product || qty <= 0 || !lines.length) {
      return [];
    }

    return lines
      .map((line: any) => {
        const rawMaterialId = `${line?.rawMaterial?._id || line?.rawMaterial || ""}`.trim();
        const material = this.rawMaterialOptions.find((row) => row?._id === rawMaterialId);
        const requiredQty = Number(line?.qtyPerUnit || 0) * qty;

        let availableQty = Number(material?.currentBalanceQty || 0);
        const matUnit = `${material?.unitLabel || ""}`.toUpperCase();
        const pcsPerPack = Number(material?.pcsPerPack || 0);

        if (matUnit === "BAG" && pcsPerPack > 0) {
          availableQty = availableQty * pcsPerPack;
        }

        return {
          materialName: line?.materialName || material?.name || "Raw Material",
          unitLabel: "PCS",
          requiredQty,
          availableQty,
          shortageQty: Math.max(0, requiredQty - availableQty),
          hasShortage: requiredQty > availableQty,
        };
      })
      .filter((row: any) => Number(row.requiredQty || 0) > 0);
  }

  get hasMaterialShortage(): boolean {
    return this.materialRequirementPreview.some((row) => !!row?.hasShortage);
  }

  loadAll(): void {
    this.loadDailyWorks();
  }

  loadStaffs(): void {
    this.loadingStaffs = true;
    this.staffService.getStaffOptions({ active: true }).subscribe({
      next: (response) => {
        this.staffOptions = response?.staffs || [];
        this.loadingStaffs = false;
      },
      error: () => {
        this.loadingStaffs = false;
      },
    });
  }

  loadDailyWorks(): void {
    this.loadingSummary = true;
    this.loadingDailyWorks = true;
    this.staffDailyWorkService.getDailyWorks(this.filters).subscribe({
      next: (response) => {
        this.dailyWorks = response?.dailyWorks || [];
        this.summary = this.buildSummary(this.dailyWorks);
        this.loadingSummary = false;
        this.loadingDailyWorks = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.loadingDailyWorks = false;
        this.showError(error?.error?.message || "Failed to load daily work entries");
      },
    });
  }

  loadFactoryProducts(): void {
    this.factoryProductService.getProductOptions({ active: true }).subscribe({
      next: (response) => {
        this.factoryProductOptions = response?.products || [];
      },
      error: () => {
        this.factoryProductOptions = [];
      },
    });
  }

  loadRawMaterials(): void {
    this.rawMaterialService.getMaterialOptions({ active: true }).subscribe({
      next: (response) => {
        this.rawMaterialOptions = response?.materials || [];
      },
      error: () => {
        this.rawMaterialOptions = [];
      },
    });
  }

  onStaffChange(): void {
    const staff = this.staffOptions.find((row) => row?._id === this.dailyWorkForm.staff);
    if (!staff) {
      return;
    }
    this.dailyWorkForm.workType = staff.workType || "";
    if (`${staff?.rateType || ""}` !== "PIECE") {
      this.dailyWorkForm.unitsCompleted = 1;
    }
    this.dailyWorkForm.earnedAmount = this.earnedAmountPreview;
  }

  onAttendanceChange(): void {
    this.dailyWorkForm.earnedAmount = this.earnedAmountPreview;
    this.dailyWorkForm.khorakiAmount = this.defaultKhorakiAmount;
    if (this.dailyWorkForm.attendanceStatus === "ABSENT") {
      this.dailyWorkForm.isKhorakiIncluded = false;
    }
  }

  onFactoryProductChange(): void {
    const product = this.selectedFactoryProduct;
    this.dailyWorkForm.factoryProductName = product?.name || "";
    this.dailyWorkForm.unit = product?.unitLabel || "PCS";
    this.dailyWorkForm.pieceRate = Number(product?.workerPieceRate || 0);
    this.dailyWorkForm.earnedAmount = this.earnedAmountPreview;
  }

  onUnitsChange(): void {
    this.dailyWorkForm.earnedAmount = this.earnedAmountPreview;
  }

  submitDailyWork(form: NgForm): void {
    if (form.invalid || this.savingDailyWork) {
      return;
    }

    this.savingDailyWork = true;
    const payload = {
      ...this.dailyWorkForm,
      earnedAmount: this.earnedAmountPreview,
      pieceRate: Number(this.selectedFactoryProduct?.workerPieceRate || this.dailyWorkForm.pieceRate || 0),
      factoryProductName: this.selectedFactoryProduct?.name || this.dailyWorkForm.factoryProductName || "",
      unit: this.selectedFactoryProduct?.unitLabel || this.dailyWorkForm.unit || "PCS",
    };

    const request$ = this.editingDailyWorkId
      ? this.staffDailyWorkService.updateDailyWork(this.editingDailyWorkId, payload)
      : this.staffDailyWorkService.createDailyWork(payload);

    request$.subscribe({
      next: (response) => {
        this.savingDailyWork = false;
        this.snackBar.open(
          response?.message || (this.editingDailyWorkId ? "Daily work updated" : "Daily work entry added"),
          "Close",
          { duration: 2500 },
        );
        this.cancelEdit(form);
        if (payload.isKhorakiIncluded && this.activeTab === 'KHORAKI') {
          this.activeTab = 'KHORAKI';
        }
        this.loadAll();
      },
      error: (error) => {
        this.savingDailyWork = false;
        this.showError(error?.error?.message || "Failed to save daily work entry");
      },
    });
  }

  startEdit(dailyWork: any): void {
    if (!this.canEditRow(dailyWork)) {
      return;
    }

    this.editingDailyWorkId = dailyWork._id;
    this.dailyWorkForm = {
      staff: dailyWork.staff?._id || dailyWork.staff || "",
      entryDate: this.formatDate(new Date(dailyWork.entryDate)),
      attendanceStatus: dailyWork.attendanceStatus || "PRESENT",
      workType: dailyWork.workType || "",
      factoryProduct: dailyWork.factoryProduct?._id || dailyWork.factoryProduct || "",
      factoryProductName: dailyWork.factoryProductName || "",
      workItem: dailyWork.workItem?._id || dailyWork.workItem || "",
      workItemName: dailyWork.workItemName || "",
      unit: dailyWork.unit || "PCS",
      pieceRate: Number(dailyWork.pieceRate || 0),
      workDetails: dailyWork.workDetails || "",
      linkedJob: dailyWork.linkedJob || "",
      unitsCompleted: Number(dailyWork.unitsCompleted || 0),
      earnedAmount: Number(dailyWork.earnedAmount || 0),
      isKhorakiIncluded: dailyWork.isKhorakiIncluded === true,
      khorakiAmount: Number(dailyWork.khorakiAmount || 100),
      note: dailyWork.note || "",
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingDailyWorkId = null;
    this.dailyWorkForm = {
      staff: "",
      entryDate: this.formatDate(new Date()),
      attendanceStatus: "PRESENT",
      workType: "",
      factoryProduct: "",
      factoryProductName: "",
      workItem: "",
      workItemName: "",
      unit: "PCS",
      pieceRate: 0,
      workDetails: "",
      linkedJob: "",
      unitsCompleted: 0,
      earnedAmount: 0,
      isKhorakiIncluded: false,
      khorakiAmount: 100,
      note: "",
    };
    if (form) {
      form.resetForm(this.dailyWorkForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      staff: "",
      attendanceStatus: "",
      verificationStatus: "",
      dateFrom: "",
      dateTo: "",
    };
    this.loadDailyWorks();
  }

  showToday(): void {
    const today = this.formatDate(new Date());
    this.filters.dateFrom = today;
    this.filters.dateTo = today;
    this.loadDailyWorks();
  }

  viewAll(): void {
    this.clearFilters();
  }

  get activeFilterSummary(): string {
    const parts: string[] = [];
    if (this.filters.search) parts.push(`Search: ${this.filters.search}`);
    if (this.filters.staff) {
      const staff = this.staffOptions.find((row) => row?._id === this.filters.staff);
      parts.push(`Staff: ${staff?.name || "Selected"}`);
    }
    if (this.filters.attendanceStatus) parts.push(`Attendance: ${this.filters.attendanceStatus}`);
    if (this.filters.verificationStatus) parts.push(`Verify: ${this.filters.verificationStatus}`);
    if (this.filters.dateFrom || this.filters.dateTo) {
      parts.push(`Date: ${this.filters.dateFrom || "..." } to ${this.filters.dateTo || "..."}`);
    }
    return parts.join(" | ");
  }

  getMaterialUsagePreview(item: any): string {
    const product = item?.factoryProduct;
    const qty = Number(item?.unitsCompleted || 0);
    const lines = product?.standardMaterialLines || [];
    if (!product || qty <= 0 || !lines.length) {
      return "";
    }

    return lines
      .map((line: any) => {
        const usedQty = Number(line?.qtyPerUnit || 0) * qty;
        const label = `${line?.materialName || line?.rawMaterial?.name || "Material"}`.trim();
        const unit = `${line?.unitLabel || "PCS"}`.trim();
        return usedQty > 0 ? `${label} ${usedQty} ${unit}` : "";
      })
      .filter((row: string) => !!row)
      .join(" | ");
  }

  getWastePreview(item: any): string {
    const product = item?.factoryProduct;
    const qty = Number(item?.unitsCompleted || 0);
    if (!product || qty <= 0) {
      return "";
    }

    const wasteQty = Number(product?.standardWasteQtyPerUnit || 0) * qty;
    if (wasteQty <= 0) {
      return "";
    }

    const wasteUnit = `${product?.standardWasteUnitLabel || "KG"}`.trim();
    const wasteValue = Number(product?.standardWasteValuePerUnit || 0) * qty;
    const wasteLabel = `Waste ${wasteQty} ${wasteUnit}`;
    return wasteValue > 0
      ? `${wasteLabel} · Rs ${wasteValue.toFixed(2)}`
      : wasteLabel;
  }

  getWorkerRatePreview(item: any): string {
    const qty = Number(item?.unitsCompleted || 0);
    const total = Number(item?.earnedAmount || 0);
    const rate = Number(item?.pieceRate || item?.factoryProduct?.workerPieceRate || 0);
    const unit = `${item?.unit || item?.factoryProduct?.unitLabel || "PCS"}`.trim();

    if (rate > 0) {
      return `Rs ${rate.toFixed(2)}/${unit}`;
    }
    if (qty > 0 && total > 0) {
      return `Rs ${(total / qty).toFixed(2)}/${unit}`;
    }
    return "";
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

  getProductMetaBadges(item: any): string[] {
    const fp = item?.factoryProduct || item;
    const variation = fp?.shopVariation || item?.shopVariation;

    const badges: string[] = [];

    const category = fp?.shopCategory?.name;
    if (category) badges.push(`Category: ${category}`);

    const brand = fp?.shopBrand?.name;
    if (brand) badges.push(`Brand: ${brand}`);

    const model = fp?.shopModel?.name;
    if (model) badges.push(`Model: ${model}`);

    const color = fp?.variationColor || variation?.attributes?.color;
    if (color && !["NONE", "NETURAL", "NATURAL"].includes(color.toUpperCase())) {
      badges.push(`Color: ${color}`);
    }

    const size = fp?.variationSize || variation?.attributes?.size;
    if (size) badges.push(`Size: ${size}`);

    const rate = fp?.workerPieceRate || item?.pieceRate;
    if (Number(rate || 0) > 0) {
      badges.push(`Worker Rate: ₹${rate}/${fp?.unitLabel || item?.unit || "PCS"}`);
    }

    return badges;
  }

  getFinancialSummary(item: any): any {
    const qty = Number(item?.unitsCompleted || 0);
    const pieceRate = Number(item?.factoryProduct?.workerPieceRate || item?.pieceRate || 0);
    const workerPay = Number(item?.earnedAmount ?? (qty * pieceRate));

    const fp = item?.factoryProduct || {};
    const matCostPerUnit = (fp?.standardMaterialLines || []).reduce((sum: number, line: any) => {
      return sum + (Number(line?.qtyPerUnit || 0) * Number(line?.rate || 0));
    }, 0);
    const otherCostPerUnit = Number(fp?.standardOtherCost || 0);
    const wasteValuePerUnit = Number(fp?.standardWasteValuePerUnit || 0);

    const costPerPiece = matCostPerUnit + (qty > 0 ? (workerPay / qty) : pieceRate) + otherCostPerUnit + wasteValuePerUnit;
    const totalBatchCost = qty * costPerPiece;

    const sellPricePerPiece = Number(fp?.shopVariation?.sellingPrice || fp?.defaultSellingPrice || 0);
    const totalSellingValue = qty * sellPricePerPiece;
    const estimatedBatchMargin = totalSellingValue - totalBatchCost;

    return {
      qty,
      pieceRate,
      workerPay,
      costPerPiece,
      totalBatchCost,
      sellPricePerPiece,
      totalSellingValue,
      estimatedBatchMargin,
      unit: item?.unit || fp?.unitLabel || "PCS",
    };
  }

  getActualBoxCostPreview(item: any): number {
    const product = item?.factoryProduct;
    const qty = Number(item?.unitsCompleted || 0);
    if (!product || qty <= 0) {
      return 0;
    }

    const materialCost = (product?.standardMaterialLines || []).reduce((sum: number, line: any) => {
      return sum + (Number(line?.qtyPerUnit || 0) * qty * Number(line?.rate || 0));
    }, 0);
    const workerCost = Number(item?.earnedAmount || 0);
    const otherCost = Number(product?.standardOtherCost || 0) * qty;
    const totalBatchCost = materialCost + workerCost + otherCost;
    return qty > 0 ? totalBatchCost / qty : 0;
  }

  deleteDailyWork(dailyWork: any): void {
    if (!this.canDeleteRow(dailyWork) || this.deletingId) {
      return;
    }

    const confirmed = window.confirm(`Delete daily work entry for ${dailyWork.staff?.name || "this worker"}?`);
    if (!confirmed) {
      return;
    }

    this.deletingId = dailyWork._id;
    this.staffDailyWorkService.deleteDailyWork(dailyWork._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Daily work entry deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete daily work entry");
      },
    });
  }

  deleteKhorakiCard(dailyWork: any): void {
    if (!dailyWork?._id || this.deletingId) {
      return;
    }

    const hasWork = Number(dailyWork.unitsCompleted || 0) > 0 || Number(dailyWork.earnedAmount || 0) > 0;
    const msg = hasWork
      ? `Remove Khoraki for ${dailyWork.staff?.name || "worker"}? (Production work will remain safe)`
      : `Delete Khoraki entry for ${dailyWork.staff?.name || "worker"}?`;

    if (!window.confirm(msg)) {
      return;
    }

    this.deletingId = dailyWork._id;
    this.staffDailyWorkService.removeKhoraki(dailyWork._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Khoraki removed", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to remove Khoraki");
      },
    });
  }

  getFormTitle(): string {
    return this.editingDailyWorkId ? "Edit Daily Work" : "Add Daily Work";
  }

  getSubmitLabel(): string {
    if (this.savingDailyWork) {
      return this.editingDailyWorkId ? "Updating..." : "Saving...";
    }
    return this.editingDailyWorkId ? "Update Daily Work" : "Save Daily Work";
  }

  trackBySummary(index: number, item: any): string {
    return `${item?._id || item?.label || "row"}-${index}`;
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }

  private buildSummary(rows: any[]): any {
    const byAttendanceMap = rows.reduce((acc: Record<string, any>, row: any) => {
      const label = row?.attendanceStatus || "UNKNOWN";
      if (!acc[label]) {
        acc[label] = { _id: label, count: 0, totalEarned: 0 };
      }
      acc[label].count += 1;
      acc[label].totalEarned += Number(row?.earnedAmount || 0);
      return acc;
    }, {});

    return {
      totalEntries: rows.length,
      presentCount: rows.filter((row: any) => row?.attendanceStatus === "PRESENT").length,
      halfDayCount: rows.filter((row: any) => row?.attendanceStatus === "HALF_DAY").length,
      absentCount: rows.filter((row: any) => row?.attendanceStatus === "ABSENT").length,
      totalEarned: rows.reduce((sum: number, row: any) => sum + Number(row?.earnedAmount || 0), 0),
      totalUnitsCompleted: rows.reduce((sum: number, row: any) => sum + Number(row?.unitsCompleted || 0), 0),
      byAttendance: Object.values(byAttendanceMap),
    };
  }
}
