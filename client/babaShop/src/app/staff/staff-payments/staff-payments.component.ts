import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { StaffDailyWorkService } from "app/shared/services/staff-daily-work.service";
import { StaffService } from "app/shared/services/staff.service";
import { StaffPaymentService } from "app/shared/services/staff-payment.service";
import { forkJoin } from "rxjs";

@Component({
  selector: "app-staff-payments",
  templateUrl: "./staff-payments.component.html",
  styleUrls: ["./staff-payments.component.css"],
})
export class StaffPaymentsComponent implements OnInit {
  readonly entryTypes = ["ADVANCE", "PAYMENT", "KHORAKI"];
  readonly paymentMethods = ["CASH", "UPI", "BANK", "CARD", "ONLINE", "CHEQUE"];

  paymentForm = {
    staff: "",
    entryDate: this.formatDate(new Date()),
    entryType: "ADVANCE",
    amount: null as number | null,
    paymentMethod: "CASH",
    note: "",
  };

  filters = {
    search: "",
    staff: "",
    entryType: "",
    paymentMethod: "",
    dateFrom: "",
    dateTo: "",
  };

  summary: any = {
    totalAdvance: 0,
    totalPayment: 0,
    netBalance: 0,
    todayEntries: 0,
    byType: [],
  };

  staffOptions: any[] = [];
  payments: any[] = [];
  dailyWorks: any[] = [];
  staffBalanceMap: Record<string, { earned: number; advance: number; payment: number; payable: number }> = {};
  editingPaymentId: string | null = null;
  loadingSummary = false;
  loadingPayments = false;
  loadingStaffs = false;
  savingPayment = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private staffService: StaffService,
    private staffPaymentService: StaffPaymentService,
    private staffDailyWorkService: StaffDailyWorkService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadStaffOptions();
    this.loadAll();
  }

  get canManage(): boolean {
    return this.authService.can("staff.payments.manage") && !this.authService.isGlobalReadOnlyMode();
  }

  get totalEntriesCount(): number {
    const rows = this.summary?.byType || [];
    return rows.reduce((sum: number, row: any) => sum + Number(row?.count || 0), 0);
  }

  get selectedStaff(): any | null {
    return this.staffOptions.find((row) => row?._id === this.paymentForm.staff) || null;
  }

  get selectedStaffBalance(): { earned: number; advance: number; payment: number; payable: number } {
    return this.staffBalanceMap[this.paymentForm.staff] || { earned: 0, advance: 0, payment: 0, payable: 0 };
  }

  get suggestedAmount(): number {
    const staff = this.selectedStaff;
    if (!staff) {
      return 0;
    }
    if (this.paymentForm.entryType === "PAYMENT") {
      return Math.max(0, Number(this.selectedStaffBalance.payable || 0));
    }
    return Math.max(0, Number(staff?.rate || 0));
  }

  loadAll(): void {
    this.loadPaymentContext();
  }

  loadStaffOptions(): void {
    this.loadingStaffs = true;
    this.staffService.getStaffOptions({ active: "true" }).subscribe({
      next: (response) => {
        this.staffOptions = response?.staffs || [];
        this.loadingStaffs = false;
      },
      error: (error) => {
        this.loadingStaffs = false;
        this.showError(error?.error?.message || "Failed to load staff options");
      },
    });
  }

  loadPaymentContext(): void {
    this.loadingSummary = true;
    this.loadingPayments = true;
    forkJoin({
      paymentsResponse: this.staffPaymentService.getPayments(this.filters),
      dailyWorksResponse: this.staffDailyWorkService.getDailyWorks({}),
    }).subscribe({
      next: ({ paymentsResponse, dailyWorksResponse }) => {
        this.payments = paymentsResponse?.payments || [];
        this.dailyWorks = dailyWorksResponse?.dailyWorks || [];
        this.staffBalanceMap = this.buildStaffBalanceMap(this.dailyWorks, this.payments);
        this.summary = this.buildSummary(this.payments);
        this.loadingSummary = false;
        this.loadingPayments = false;
        if (!this.editingPaymentId && this.paymentForm.staff) {
          this.applySuggestedAmount();
        }
      },
      error: (error) => {
        this.loadingSummary = false;
        this.loadingPayments = false;
        this.showError(error?.error?.message || "Failed to load entries");
      },
    });
  }

  submitPayment(form: NgForm): void {
    if (form.invalid || this.savingPayment) {
      return;
    }

    this.savingPayment = true;
    const request$ = this.editingPaymentId
      ? this.staffPaymentService.updatePayment(this.editingPaymentId, this.paymentForm)
      : this.staffPaymentService.createPayment(this.paymentForm);

    request$.subscribe({
      next: (response) => {
        this.savingPayment = false;
        this.snackBar.open(response?.message || (this.editingPaymentId ? "Entry updated" : "Entry added"), "Close", {
          duration: 2500,
        });
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingPayment = false;
        this.showError(error?.error?.message || "Failed to save entry");
      },
    });
  }

  startEdit(payment: any): void {
    if (!this.canManage || !payment?._id) {
      return;
    }
    this.editingPaymentId = payment._id;
    this.paymentForm = {
      staff: payment.staff?._id || "",
      entryDate: this.formatDate(new Date(payment.entryDate)),
      entryType: payment.entryType || "ADVANCE",
      amount: Number(payment.amount || 0),
      paymentMethod: payment.paymentMethod || "CASH",
      note: payment.note || "",
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingPaymentId = null;
    this.paymentForm = {
      staff: "",
      entryDate: this.formatDate(new Date()),
      entryType: "ADVANCE",
      amount: null,
      paymentMethod: "CASH",
      note: "",
    };
    if (form) {
      form.resetForm(this.paymentForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      staff: "",
      entryType: "",
      paymentMethod: "",
      dateFrom: "",
      dateTo: "",
    };
    this.loadPaymentContext();
  }

  showToday(): void {
    const today = this.formatDate(new Date());
    this.filters.dateFrom = today;
    this.filters.dateTo = today;
    this.loadPaymentContext();
  }

  viewAll(): void {
    this.clearFilters();
  }

  deletePayment(payment: any): void {
    if (!this.canManage || !payment?._id || this.deletingId) {
      return;
    }
    const confirmed = window.confirm(`Delete ${payment.entryType?.toLowerCase()} entry for ${payment.staff?.name || "staff"}?`);
    if (!confirmed) {
      return;
    }
    this.deletingId = payment._id;
    this.staffPaymentService.deletePayment(payment._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Entry deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete entry");
      },
    });
  }

  getFormTitle(): string {
    return this.editingPaymentId ? "Edit Staff Entry" : "Add Staff Entry";
  }

  getSubmitLabel(): string {
    if (this.savingPayment) {
      return this.editingPaymentId ? "Updating..." : "Saving...";
    }
    return this.editingPaymentId ? "Update Entry" : "Save Entry";
  }

  trackBySummary(index: number, item: any): string {
    return `${item?._id || "row"}-${index}`;
  }

  onStaffChange(): void {
    if (this.editingPaymentId) {
      return;
    }
    this.applySuggestedAmount();
  }

  onEntryTypeChange(): void {
    if (this.editingPaymentId && this.paymentForm.amount !== null) {
      return;
    }
    this.applySuggestedAmount();
  }

  private applySuggestedAmount(): void {
    const staff = this.selectedStaff;
    if (!staff) {
      this.paymentForm.amount = null;
      return;
    }
    this.paymentForm.amount = this.suggestedAmount > 0 ? this.suggestedAmount : null;
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }

  private buildSummary(rows: any[]): any {
    const today = this.formatDate(new Date());
    const byTypeMap = rows.reduce((acc: Record<string, any>, row: any) => {
      const label = row?.entryType || "UNKNOWN";
      if (!acc[label]) {
        acc[label] = { _id: label, count: 0, totalAmount: 0 };
      }
      acc[label].count += 1;
      acc[label].totalAmount += Number(row?.amount || 0);
      return acc;
    }, {});

    return {
      totalAdvance: rows.filter((row: any) => row?.entryType === "ADVANCE").reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0),
      totalPayment: rows.filter((row: any) => row?.entryType === "PAYMENT").reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0),
      todayEntries: rows.filter((row: any) => this.formatDate(new Date(row?.entryDate || row?.createdAt || new Date())) === today).length,
      byType: Object.values(byTypeMap),
    };
  }

  private buildStaffBalanceMap(dailyWorks: any[], payments: any[]): Record<string, { earned: number; advance: number; payment: number; payable: number }> {
    const map: Record<string, { earned: number; advance: number; payment: number; payable: number }> = {};

    for (const row of dailyWorks || []) {
      const staffId = `${row?.staff?._id || row?.staff || ""}`;
      if (!staffId) {
        continue;
      }
      if (!map[staffId]) {
        map[staffId] = { earned: 0, advance: 0, payment: 0, payable: 0 };
      }
      map[staffId].earned += Number(row?.earnedAmount || 0);
    }

    for (const row of payments || []) {
      const staffId = `${row?.staff?._id || row?.staff || ""}`;
      if (!staffId) {
        continue;
      }
      if (!map[staffId]) {
        map[staffId] = { earned: 0, advance: 0, payment: 0, payable: 0 };
      }
      if (`${row?.entryType || ""}` === "ADVANCE") {
        map[staffId].advance += Number(row?.amount || 0);
      } else if (`${row?.entryType || ""}` === "PAYMENT") {
        map[staffId].payment += Number(row?.amount || 0);
      }
    }

    Object.keys(map).forEach((staffId) => {
      map[staffId].payable = Number(map[staffId].earned || 0) - Number(map[staffId].advance || 0) - Number(map[staffId].payment || 0);
    });

    return map;
  }
}
