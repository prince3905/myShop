import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { DailyExpenseService } from "app/shared/services/daily-expense.service";
import { AuthService } from "app/shared/services/auth.service";

@Component({
  selector: "app-daily-expense",
  templateUrl: "./daily-expense.component.html",
  styleUrls: ["./daily-expense.component.css"],
})
export class DailyExpenseComponent implements OnInit {
  readonly categories = [
    "Chai Pani",
    "Transport",
    "Diesel",
    "Repair",
    "Factory Expense",
    "Office Expense",
    "Advance Given",
    "Utility",
    "Misc",
  ];

  readonly departments = [
    "Factory",
    "Office",
    "Staff",
    "Transport",
    "Maintenance",
    "General",
  ];

  readonly accountHeads = [
    "Factory Expense",
    "Office Expense",
    "Staff Expense",
    "Karigar Expense",
    "Transport",
    "Maintenance",
    "Utility",
    "Misc",
  ];

  readonly paymentMethods = ["CASH", "UPI", "BANK", "CARD", "ONLINE", "CHEQUE"];

  expenseForm = {
    expenseDate: this.formatDate(new Date()),
    category: "Factory Expense",
    department: "Factory",
    accountHead: "Factory Expense",
    amount: null as number | null,
    paymentMethod: "CASH",
    note: "",
  };
  editingExpenseId: string | null = null;

  filters = {
    search: "",
    category: "",
    department: "",
    paymentMethod: "",
    dateFrom: "",
    dateTo: "",
  };

  summary: any = {
    totalAmount: 0,
    totalEntries: 0,
    todayAmount: 0,
    todayEntries: 0,
    byCategory: [],
    byDepartment: [],
  };

  expenses: any[] = [];
  loadingSummary = false;
  loadingExpenses = false;
  savingExpense = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private dailyExpenseService: DailyExpenseService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadAll();
  }

  get canManage(): boolean {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${this.userRole || ""}`);
  }

  loadAll(): void {
    this.loadSummary();
    this.loadExpenses();
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.dailyExpenseService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load expense summary");
      },
    });
  }

  loadExpenses(): void {
    this.loadingExpenses = true;
    this.dailyExpenseService.getExpenses(this.filters).subscribe({
      next: (response) => {
        this.expenses = response?.expenses || [];
        this.loadingExpenses = false;
      },
      error: (error) => {
        this.loadingExpenses = false;
        this.showError(error?.error?.message || "Failed to load daily expenses");
      },
    });
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      category: "",
      department: "",
      paymentMethod: "",
      dateFrom: "",
      dateTo: "",
    };
    this.loadExpenses();
  }

  deleteExpense(expense: any): void {
    if (!this.canManage || !expense?._id || this.deletingId) {
      return;
    }

    const confirmed = window.confirm(`Delete expense of Rs ${Number(expense.amount || 0).toFixed(2)}?`);
    if (!confirmed) {
      return;
    }

    this.deletingId = expense._id;
    this.dailyExpenseService.deleteExpense(expense._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Expense deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete expense");
      },
    });
  }

  startEdit(expense: any): void {
    if (!this.canManage || !expense?._id) {
      return;
    }

    this.editingExpenseId = expense._id;
    this.expenseForm = {
      expenseDate: this.formatDate(new Date(expense.expenseDate)),
      category: expense.category || "Factory Expense",
      department: expense.department || "Factory",
      accountHead: expense.accountHead || "Factory Expense",
      amount: Number(expense.amount || 0),
      paymentMethod: expense.paymentMethod || "CASH",
      note: expense.note || "",
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingExpenseId = null;
    this.expenseForm = {
      expenseDate: this.formatDate(new Date()),
      category: "Factory Expense",
      department: "Factory",
      accountHead: "Factory Expense",
      amount: null,
      paymentMethod: "CASH",
      note: "",
    };
    if (form) {
      form.resetForm(this.expenseForm);
    }
  }

  getFormTitle(): string {
    return this.editingExpenseId ? "Edit Expense" : "Add Expense";
  }

  getSubmitLabel(): string {
    if (this.savingExpense) {
      return this.editingExpenseId ? "Updating..." : "Saving...";
    }
    return this.editingExpenseId ? "Update Expense" : "Save Expense";
  }

  trackBySummary(index: number, item: any): string {
    return `${item?._id || "row"}-${index}`;
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  submitExpense(form: NgForm): void {
    if (form.invalid || this.savingExpense) {
      return;
    }

    this.savingExpense = true;
    const request$ = this.editingExpenseId
      ? this.dailyExpenseService.updateExpense(this.editingExpenseId, this.expenseForm)
      : this.dailyExpenseService.createExpense(this.expenseForm);

    request$.subscribe({
      next: (response) => {
        this.savingExpense = false;
        this.snackBar.open(
          response?.message || (this.editingExpenseId ? "Daily expense updated" : "Daily expense added"),
          "Close",
          { duration: 2500 },
        );
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingExpense = false;
        this.showError(error?.error?.message || "Failed to save daily expense");
      },
    });
  }
}
