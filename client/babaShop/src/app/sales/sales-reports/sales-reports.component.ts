import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SalesService } from "app/shared/services/sales.service";

@Component({
  selector: "app-sales-reports",
  templateUrl: "./sales-reports.component.html",
  styleUrls: ["./sales-reports.component.css"],
})
export class SalesReportsComponent implements OnInit {
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
  };

  salesRows: any[] = [];
  returnRows: any[] = [];

  constructor(
    private salesService: SalesService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  applyFilters(): void {
    this.loadAll();
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
      },
      error: () => {
        this.overview = {
          sales: {
            count: 0,
            totalAmount: 0,
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
        };
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
}
