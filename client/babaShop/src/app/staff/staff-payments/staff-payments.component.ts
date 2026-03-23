import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { StaffService } from "app/shared/services/staff.service";
import { StaffPaymentService } from "app/shared/services/staff-payment.service";

@Component({
  selector: "app-staff-payments",
  templateUrl: "./staff-payments.component.html",
  styleUrls: ["./staff-payments.component.css"],
})
export class StaffPaymentsComponent implements OnInit {
  readonly entryTypes = ["ADVANCE", "PAYMENT"];
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
    private snackBar: MatSnackBar,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadStaffOptions();
    this.loadAll();
  }

  get canManage(): boolean {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${this.userRole || ""}`);
  }

  loadAll(): void {
    this.loadSummary();
    this.loadPayments();
  }

  loadStaffOptions(): void {
    this.loadingStaffs = true;
    this.staffService.getStaffs({ active: "true" }).subscribe({
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

  loadSummary(): void {
    this.loadingSummary = true;
    this.staffPaymentService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load payment summary");
      },
    });
  }

  loadPayments(): void {
    this.loadingPayments = true;
    this.staffPaymentService.getPayments(this.filters).subscribe({
      next: (response) => {
        this.payments = response?.payments || [];
        this.loadingPayments = false;
      },
      error: (error) => {
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
    this.loadPayments();
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

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }
}
