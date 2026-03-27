import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { StaffDailyWorkService } from "app/shared/services/staff-daily-work.service";
import { StaffService } from "app/shared/services/staff.service";
import { FactoryProductService } from "app/shared/services/factory-product.service";

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
    note: "",
  };

  filters = {
    search: "",
    staff: "",
    attendanceStatus: "",
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
  dailyWorks: any[] = [];
  editingDailyWorkId: string | null = null;
  loadingStaffs = false;
  loadingSummary = false;
  loadingDailyWorks = false;
  savingDailyWork = false;
  deletingId: string | null = null;
  userRole: string | null = null;
  currentShopLabel = "-";

  constructor(
    private staffService: StaffService,
    private factoryProductService: FactoryProductService,
    private staffDailyWorkService: StaffDailyWorkService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    const user = this.authService.getCurrentUser();
    this.currentShopLabel = user?.shopCode || user?.shop || "-";
    this.loadStaffs();
    this.loadFactoryProducts();
    this.loadAll();
  }

  get canManage(): boolean {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${this.userRole || ""}`);
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

  loadAll(): void {
    this.loadDailyWorks();
  }

  loadStaffs(): void {
    this.loadingStaffs = true;
    this.staffService.getStaffs({ active: true }).subscribe({
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
    this.factoryProductService.getProducts({ active: true }).subscribe({
      next: (response) => {
        this.factoryProductOptions = response?.products || [];
      },
      error: () => {
        this.factoryProductOptions = [];
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
        this.loadAll();
      },
      error: (error) => {
        this.savingDailyWork = false;
        this.showError(error?.error?.message || "Failed to save daily work entry");
      },
    });
  }

  startEdit(dailyWork: any): void {
    if (!this.canManage || !dailyWork?._id) {
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
    if (this.filters.dateFrom || this.filters.dateTo) {
      parts.push(`Date: ${this.filters.dateFrom || "..." } to ${this.filters.dateTo || "..."}`);
    }
    return parts.join(" | ");
  }

  deleteDailyWork(dailyWork: any): void {
    if (!this.canManage || !dailyWork?._id || this.deletingId) {
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
