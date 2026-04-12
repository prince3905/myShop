import { Component, OnDestroy, OnInit } from "@angular/core";
import * as Chartist from "chartist";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { SalesService } from "app/shared/services/sales.service";

@Component({
  selector: "app-sales-reports",
  templateUrl: "./sales-reports.component.html",
  styleUrls: ["./sales-reports.component.css"],
})
export class SalesReportsComponent implements OnInit, OnDestroy {
  loading = false;

  filters = {
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
    paymentMethod: "",
    returnStatus: "",
    search: "",
    refundMethod: "",
  };

  overview: any = {
    sales: {
      count: 0,
      totalAmount: 0,
      totalCostAmount: 0,
      grossProfit: 0,
      grossMarginPercent: 0,
      totalPaid: 0,
      totalDue: 0,
      totalReturnedQty: 0,
      totalReturnedAmount: 0,
      totalRefundedAmount: 0,
    },
    returns: {
      count: 0,
      totalAmount: 0,
      totalRefund: 0,
      totalCredit: 0,
      totalDueAdjusted: 0,
      totalQty: 0,
    },
    profitByItem: [],
    profitByCustomer: [],
    profitByCategory: [],
    profitTrend: {
      labels: [],
      sales: [],
      cost: [],
      profit: [],
    },
  };

  paymentSummary = {
    totalCash: 0,
    totalOnline: 0,
    totalCollected: 0,
  };

  zReport: any = {
    loading: false,
    data: null,
  };

  salesRows: any[] = [];
  returnRows: any[] = [];
  private profitTrendChart: any = null;
  private profitChartRenderTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private salesService: SalesService,
    private snackBar: MatSnackBar,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  ngOnDestroy(): void {
    if (this.profitChartRenderTimer) {
      clearTimeout(this.profitChartRenderTimer);
    }
    this.profitTrendChart?.detach?.();
  }

  get canViewSensitivePricing(): boolean {
    return this.authService.canViewSensitivePricing();
  }

  applyFilters(): void {
    this.loadAll();
    this.loadPaymentSummary(); // Sync payment summary with main filters
  }

  scrollToSection(id: string): void {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  openZReport(): void {
    if (!this.zReport.data) {
      // If data not loaded, generate it first
      this.generateZReport();
    }
    // Scroll after a short delay to allow data to render
    setTimeout(() => {
      this.scrollToSection('z-report-section');
    }, 500);
  }

  loadPaymentSummary(): void {

  setQuickDate(range: "today" | "week" | "month" | "year" | "all"): void {
    const now = new Date();
    this.filters.dateFrom = null;
    this.filters.dateTo = null;

    if (range === "today") {
      this.filters.dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      this.filters.dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (range === "week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      this.filters.dateFrom = new Date(now.setDate(diff));
      this.filters.dateTo = new Date();
    } else if (range === "month") {
      this.filters.dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      this.filters.dateTo = new Date();
    } else if (range === "year") {
      this.filters.dateFrom = new Date(now.getFullYear(), 0, 1);
      this.filters.dateTo = new Date();
    } else {
      this.filters.dateFrom = null;
      this.filters.dateTo = null;
    }

    // Refresh both Payment Summary and Main Report
    this.applyFilters();
  }

  resetFilters(): void {
    this.filters = {
      dateFrom: null,
      dateTo: null,
      paymentMethod: "",
      returnStatus: "",
      search: "",
      refundMethod: "",
    };
    this.loadAll();
  }

  private loadAll(): void {
    this.loading = true;

    const commonParams = {
      dateFrom: this.filters.dateFrom ? this.formatDate(this.filters.dateFrom) : undefined,
      dateTo: this.filters.dateTo ? this.formatDate(this.filters.dateTo) : undefined,
      paymentMethod: this.filters.paymentMethod || undefined,
      returnStatus: this.filters.returnStatus || undefined,
    };

    this.salesService.getSalesReportOverview(commonParams).subscribe({
      next: (res: any) => {
        this.overview = res?.data || this.overview;
        if (this.canViewSensitivePricing) {
          this.scheduleProfitTrendChartRender();
        }
      },
      error: () => {
        this.overview = {
          sales: {
            count: 0,
            totalAmount: 0,
            totalCostAmount: 0,
            grossProfit: 0,
            grossMarginPercent: 0,
            totalPaid: 0,
            totalDue: 0,
            totalReturnedQty: 0,
            totalReturnedAmount: 0,
            totalRefundedAmount: 0,
          },
          returns: {
            count: 0,
            totalAmount: 0,
            totalRefund: 0,
            totalCredit: 0,
            totalDueAdjusted: 0,
            totalQty: 0,
          },
          profitByItem: [],
          profitByCustomer: [],
          profitByCategory: [],
          profitTrend: {
            labels: [],
            sales: [],
            cost: [],
            profit: [],
          },
        };
        this.profitTrendChart?.detach?.();
      },
    });

    this.salesService
      .getSales({
        page: 1,
        perPage: 20,
        startDate: commonParams.dateFrom,
        endDate: commonParams.dateTo,
        paymentMethod: commonParams.paymentMethod,
        returnStatus: commonParams.returnStatus,
      })
      .subscribe({
        next: (res: any) => {
          this.salesRows = Array.isArray(res?.itemResults) ? res.itemResults : [];
          this.loading = false;
        },
        error: () => {
          this.salesRows = [];
          this.loading = false;
          this.snackBar.open("Failed to load sales report rows", "Close", { duration: 2600 });
        },
      });

    this.salesService
      .getAllSaleReturns({
        page: 1,
        limit: 20,
        search: this.filters.search || undefined,
        dateFrom: commonParams.dateFrom,
        dateTo: commonParams.dateTo,
        refundMethod: this.filters.refundMethod || undefined,
      })
      .subscribe({
        next: (res: any) => {
          this.returnRows = Array.isArray(res?.data) ? res.data : [];
        },
        error: () => {
          this.returnRows = [];
        },
      });
  }

  private formatDate(d: Date): string {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = `${dt.getMonth() + 1}`.padStart(2, "0");
    const dd = `${dt.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  private renderProfitTrendChart(): void {
    const chartData = this.overview?.profitTrend || {};
    const labels = Array.isArray(chartData.labels) && chartData.labels.length ? chartData.labels : ["-"];
    const sales = Array.isArray(chartData.sales) && chartData.sales.length ? chartData.sales : [0];
    const cost = Array.isArray(chartData.cost) && chartData.cost.length ? chartData.cost : [0];
    const profit = Array.isArray(chartData.profit) && chartData.profit.length ? chartData.profit : [0];

    this.profitTrendChart?.detach?.();
    this.profitTrendChart = new Chartist.Line(
      "#profitTrendChart",
      {
        labels,
        series: [sales, cost, profit],
      },
      {
        low: 0,
        fullWidth: true,
        chartPadding: { top: 10, right: 16, bottom: 0, left: 0 },
        lineSmooth: Chartist.Interpolation.cardinal({ tension: 0 }),
      },
    );
  }

  private scheduleProfitTrendChartRender(): void {
    if (this.profitChartRenderTimer) {
      clearTimeout(this.profitChartRenderTimer);
    }
    this.profitChartRenderTimer = setTimeout(() => this.renderProfitTrendChart(), 100);
  }
}
