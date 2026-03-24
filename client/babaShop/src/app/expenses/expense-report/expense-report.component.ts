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
    "Chai Pani",
    "Transport",
    "Diesel",
    "Repair",
    "Factory Expense",
    "Office Expense",
    "Utility",
  ];

  readonly departments = ["Factory", "Office", "Shop", "Staff", "Transport", "Maintenance", "General"];

  readonly paymentMethods = ["CASH", "UPI", "BANK", "CARD", "ONLINE", "CHEQUE"];

  filters = {
    search: "",
    category: "",
    department: "",
    paymentMethod: "",
    dateFrom: "",
    dateTo: "",
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
  dateWiseSummary: Array<{ label: string; amount: number; count: number }> = [];
  departmentHighlights: Array<{ label: string; amount: number; count: number }> = [];
  monthlyComparison = {
    currentMonthAmount: 0,
    previousMonthAmount: 0,
    changeAmount: 0,
    changePercent: 0,
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
        this.dateWiseSummary = this.groupByDate(expenses);
        this.departmentHighlights = this.summary.byDepartment.slice(0, 4);
        this.monthlyComparison = this.buildMonthlyComparison(expenses);
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
      dateFrom: "",
      dateTo: "",
    };
    this.loadReport();
  }

  showToday(): void {
    const today = this.formatDate(new Date());
    this.filters.dateFrom = today;
    this.filters.dateTo = today;
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

  private groupByDate(rows: any[]): Array<{ label: string; amount: number; count: number }> {
    const grouped = rows.reduce((acc: Record<string, { label: string; amount: number; count: number }>, row: any) => {
      const key = this.formatDate(new Date(row?.expenseDate || row?.createdAt || new Date()));
      if (!acc[key]) {
        acc[key] = { label: key, amount: 0, count: 0 };
      }
      acc[key].amount += Number(row?.amount || 0);
      acc[key].count += 1;
      return acc;
    }, {});

    return (Object.values(grouped) as Array<{ label: string; amount: number; count: number }>)
      .sort((a, b) => (a.label < b.label ? 1 : -1))
      .slice(0, 14);
  }

  private buildMonthlyComparison(rows: any[]) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const previousMonth = previousMonthDate.getMonth();
    const previousYear = previousMonthDate.getFullYear();

    const currentMonthAmount = rows.reduce((sum: number, row: any) => {
      const date = new Date(row?.expenseDate || row?.createdAt || new Date());
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
        ? sum + Number(row?.amount || 0)
        : sum;
    }, 0);

    const previousMonthAmount = rows.reduce((sum: number, row: any) => {
      const date = new Date(row?.expenseDate || row?.createdAt || new Date());
      return date.getMonth() === previousMonth && date.getFullYear() === previousYear
        ? sum + Number(row?.amount || 0)
        : sum;
    }, 0);

    const changeAmount = currentMonthAmount - previousMonthAmount;
    const changePercent = previousMonthAmount > 0 ? (changeAmount / previousMonthAmount) * 100 : 0;

    return {
      currentMonthAmount,
      previousMonthAmount,
      changeAmount,
      changePercent,
    };
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
