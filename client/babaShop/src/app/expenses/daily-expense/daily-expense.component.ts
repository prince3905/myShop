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
    "Utility",
  ];

  readonly categoryDepartmentMap: Record<string, string[]> = {
    "Chai Pani": ["Factory", "Office", "Staff"],
    Transport: ["Factory", "Office", "Shop"],
    Diesel: ["Factory", "Office", "Shop"],
    Repair: ["Maintenance", "Factory", "Office", "Shop"],
    "Factory Expense": ["Factory"],
    "Office Expense": ["Office"],
    Utility: ["Factory", "Office", "Shop"],
  };

  readonly departmentAccountHeadMap: Record<string, string[]> = {
    Factory: ["Factory Expense", "Consumables", "Karigar Expense", "Worker Payment", "Other"],
    Office: ["Office Expense", "Staff Welfare", "Miscellaneous", "Other"],
    Shop: ["Transport", "Loading & Unloading", "Vehicle Rent", "Toll & Parking", "Other"],
    Staff: ["Staff Expense", "Staff Welfare", "Other"],
    Transport: ["Transport", "Loading & Unloading", "Diesel & Fuel", "Other"],
    Maintenance: ["Maintenance", "Machine Repair", "Consumables", "Other"],
    General: ["Miscellaneous", "Other"],
  };

  readonly categoryDepartmentAccountHeadMap: Record<string, Record<string, string[]>> = {
    "Chai Pani": {
      Factory: ["Factory Expense", "Staff Welfare", "Other"],
      Office: ["Office Expense", "Staff Welfare", "Other"],
      Staff: ["Staff Welfare", "Staff Expense", "Other"],
    },
    Transport: {
      Factory: ["Loading & Unloading", "Transport", "Vehicle Rent", "Other"],
      Office: ["Transport", "Vehicle Rent", "Toll & Parking", "Other"],
      Shop: ["Transport", "Loading & Unloading", "Vehicle Rent", "Toll & Parking", "Other"],
    },
    Diesel: {
      Factory: ["Diesel & Fuel", "Factory Expense", "Other"],
      Office: ["Diesel & Fuel", "Office Expense", "Other"],
      Shop: ["Diesel & Fuel", "Transport", "Other"],
    },
    Repair: {
      Maintenance: ["Maintenance", "Machine Repair", "Consumables", "Other"],
      Factory: ["Maintenance", "Machine Repair", "Factory Expense", "Other"],
      Office: ["Maintenance", "Office Expense", "Other"],
      Shop: ["Maintenance", "Machine Repair", "Shop Expense", "Other"],
    },
    Utility: {
      Factory: ["Utility", "Electricity & Power", "Water Expense", "Internet & Phone", "Other"],
      Office: ["Utility", "Electricity & Power", "Water Expense", "Internet & Phone", "Other"],
      Shop: ["Utility", "Electricity & Power", "Water Expense", "Internet & Phone", "Other"],
    },
  };

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
    page: 1,
    limit: 50,
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
  totalCount = 0;
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
    this.syncExpenseFormSelections();
    this.loadAll();
  }

  get canManage(): boolean {
    return this.authService.can("expenses.daily.manage") && !this.authService.isGlobalReadOnlyMode();
  }

  get departmentOptions(): string[] {
    return this.categoryDepartmentMap[this.expenseForm.category] || ["General"];
  }

  get accountHeadOptions(): string[] {
    const categoryHeads = this.categoryDepartmentAccountHeadMap[this.expenseForm.category]?.[this.expenseForm.department];
    if (categoryHeads?.length) {
      return categoryHeads;
    }
    return this.departmentAccountHeadMap[this.expenseForm.department] || ["Other"];
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.filters.limit);
  }

  allExpenses: any[] = [];
  private searchDebounceTimer: any = null;

  loadExpenses(updateAll: boolean = true): void {
    this.loadingExpenses = true;
    this.dailyExpenseService.getExpenses(this.filters).subscribe({
      next: (response) => {
        const fetched = response?.expenses || [];
        if (updateAll || !this.allExpenses.length) {
          this.allExpenses = [...fetched];
        }
        this.expenses = fetched;
        this.totalCount = response?.totalCount || this.expenses.length;
        this.loadingExpenses = false;
      },
      error: (error) => {
        this.loadingExpenses = false;
        this.showError(error?.error?.message || "Failed to load expenses");
      },
    });
  }

  onSearchInput(): void {
    const q = (this.filters.search || "").trim().toLowerCase();
    if (this.allExpenses && this.allExpenses.length > 0) {
      if (!q) {
        this.expenses = [...this.allExpenses];
      } else {
        this.expenses = this.allExpenses.filter((e: any) => {
          const cat = (e.category || "").toLowerCase();
          const dept = (e.department || "").toLowerCase();
          const head = (e.accountHead || "").toLowerCase();
          const note = (e.note || "").toLowerCase();
          const payee = (e.payeeName || "").toLowerCase();
          return cat.includes(q) || dept.includes(q) || head.includes(q) || note.includes(q) || payee.includes(q);
        });
      }
    }

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.loadExpenses(false);
    }, 300);
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.dailyExpenseService.getSummary().subscribe({
      next: (response) => {
        if (response?.summary) {
          this.summary = response.summary;
        }
        this.loadingSummary = false;
      },
      error: () => {
        this.loadingSummary = false;
      },
    });
  }

  loadAll(): void {
    this.loadSummary();
    this.loadExpenses();
  }

  onPageChange(page: number): void {
    this.filters.page = page;
    this.loadExpenses();
  }

  clearFilters(): void {
    this.filters = {
      ...this.filters,
      search: "",
      category: "",
      department: "",
      paymentMethod: "",
      dateFrom: "",
      dateTo: "",
      page: 1,
    };
    this.loadExpenses();
  }

  showTodayExpenses(): void {
    const today = this.formatDate(new Date());
    this.filters.dateFrom = today;
    this.filters.dateTo = today;
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
    this.syncExpenseFormSelections();
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
    this.syncExpenseFormSelections();
    if (form) {
      form.resetForm(this.expenseForm);
    }
  }

  onCategoryChange(): void {
    const departments = this.departmentOptions;
    if (!departments.includes(this.expenseForm.department)) {
      this.expenseForm.department = departments[0];
    }
    this.onDepartmentChange();
  }

  onDepartmentChange(): void {
    const heads = this.accountHeadOptions;
    if (!heads.includes(this.expenseForm.accountHead)) {
      this.expenseForm.accountHead = heads[0];
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

  exportExpenses(): void {
    const exportData = this.expenses.map((e) => ({
      Date: this.formatDate(new Date(e.expenseDate)),
      Category: e.category,
      Department: e.department,
      'Account Head': e.accountHead,
      Amount: e.amount,
      'Payment Method': e.paymentMethod,
      Note: e.note || '',
      Status: e.status,
      Created: e.createdBy?.pFname || e.createdBy?.email || 'N/A',
    }));

    const csv = [
      Object.keys(exportData[0] || {}).join(','),
      ...exportData.map((row) => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-expenses-${this.formatDate(new Date())}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  toggleStatus(expense: any): void {
    if (!this.canManage || !expense?._id) return;
    const newStatus = expense.status === 'ACTIVE' ? 'CANCELLED' : 'ACTIVE';
    this.dailyExpenseService.updateExpense(expense._id, { status: newStatus }).subscribe({
      next: (response) => {
        this.snackBar.open(response?.message || 'Status updated', 'Close', { duration: 2000 });
        this.loadAll();
      },
      error: (error) => {
        this.showError(error?.error?.message || 'Failed to update status');
      },
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private syncExpenseFormSelections(): void {
    this.onCategoryChange();
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
