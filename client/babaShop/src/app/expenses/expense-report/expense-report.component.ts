import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { DailyExpenseService } from "app/shared/services/daily-expense.service";

@Component({
  selector: "app-expense-report",
  templateUrl: "./expense-report.component.html",
  styleUrls: ["./expense-report.component.css"],
})
export class ExpenseReportComponent implements OnInit {
  readonly categories = [
    "CHAI_PANI",
    "LABOUR",
    "TRANSPORT",
    "DIESEL",
    "BIJLI",
    "REPAIR",
    "ADVANCE",
    "FACTORY_EXPENSE",
    "OFFICE_EXPENSE",
    "MAINTENANCE",
    "UTILITY",
    "MISC",
  ];

  readonly departments = ["FACTORY", "OFFICE", "STAFF", "WORKSHOP", "TRANSPORT"];

  readonly paymentMethods = ["CASH", "UPI", "BANK", "CARD", "ONLINE", "CHEQUE"];

  filters = {
    search: "",
    category: "",
    department: "",
    paymentMethod: "",
    dateFrom: this.formatDate(new Date()),
    dateTo: this.formatDate(new Date()),
  };

  loading = false;
  expenses: any[] = [];
  summary = {
    totalAmount: 0,
    totalEntries: 0,
    todayAmount: 0,
    todayEntries: 0,
    byCategory: [] as Array<{ label: string; count: number; amount: number }>,
    byDepartment: [] as Array<{ label: string; count: number; amount: number }>,
    byPaymentMethod: [] as Array<{ label: string; count: number; amount: number }>,
  };

  constructor(
    private dailyExpenseService: DailyExpenseService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    this.dailyExpenseService.getExpenses(this.filters).subscribe({
      next: (response) => {
        const expenses = response?.expenses || [];
        this.expenses = expenses;
        this.summary = {
          totalAmount: expenses.reduce((sum: number, row: any) => sum + Number(row?.amount || 0), 0),
          totalEntries: expenses.length,
          todayAmount: this.sumToday(expenses),
          todayEntries: this.countToday(expenses),
          byCategory: this.groupBy(expenses, "category"),
          byDepartment: this.groupBy(expenses, "department"),
          byPaymentMethod: this.groupBy(expenses, "paymentMethod"),
        };
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || "Failed to load expense report", "Close", { duration: 2500 });
      },
    });
  }

  resetFilters(): void {
    this.filters = {
      search: "",
      category: "",
      department: "",
      paymentMethod: "",
      dateFrom: this.formatDate(new Date()),
      dateTo: this.formatDate(new Date()),
    };
    this.loadReport();
  }

  trackByLabel(index: number, item: any): string {
    return `${item?.label || "row"}-${index}`;
  }

  private groupBy(rows: any[], key: string): Array<{ label: string; count: number; amount: number }> {
    const grouped = rows.reduce((acc: Record<string, { label: string; count: number; amount: number }>, row: any) => {
      const label = `${row?.[key] || "Unknown"}`.trim() || "Unknown";
      if (!acc[label]) {
        acc[label] = { label, count: 0, amount: 0 };
      }
      acc[label].count += 1;
      acc[label].amount += Number(row?.amount || 0);
      return acc;
    }, {});

    return (Object.values(grouped) as Array<{ label: string; count: number; amount: number }>)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }

  private sumToday(rows: any[]): number {
    const today = this.formatDate(new Date());
    return rows.reduce((sum: number, row: any) => {
      const rowDate = this.formatDate(new Date(row?.expenseDate || row?.createdAt || new Date()));
      return rowDate === today ? sum + Number(row?.amount || 0) : sum;
    }, 0);
  }

  private countToday(rows: any[]): number {
    const today = this.formatDate(new Date());
    return rows.filter((row: any) => this.formatDate(new Date(row?.expenseDate || row?.createdAt || new Date())) === today).length;
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
