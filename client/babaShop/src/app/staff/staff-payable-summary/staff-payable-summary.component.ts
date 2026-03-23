import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { StaffDailyWorkService } from "app/shared/services/staff-daily-work.service";
import { StaffPaymentService } from "app/shared/services/staff-payment.service";
import { StaffService } from "app/shared/services/staff.service";
import { forkJoin } from "rxjs";

@Component({
  selector: "app-staff-payable-summary",
  templateUrl: "./staff-payable-summary.component.html",
  styleUrls: ["./staff-payable-summary.component.css"],
})
export class StaffPayableSummaryComponent implements OnInit {
  filters = {
    search: "",
    staff: "",
    dateFrom: this.formatDate(new Date()),
    dateTo: this.formatDate(new Date()),
  };

  loading = false;
  staffOptions: any[] = [];
  rows: Array<{ staffId: string; name: string; workType: string; earned: number; advance: number; payment: number; payable: number; workEntries: number }> = [];
  summary = {
    totalEarned: 0,
    totalAdvance: 0,
    totalPayment: 0,
    totalPayable: 0,
  };

  constructor(
    private staffService: StaffService,
    private staffDailyWorkService: StaffDailyWorkService,
    private staffPaymentService: StaffPaymentService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    forkJoin({
      staffResponse: this.staffService.getStaffs({ active: "true", search: this.filters.search }),
      dailyWorkResponse: this.staffDailyWorkService.getDailyWorks(this.filters),
      paymentResponse: this.staffPaymentService.getPayments(this.filters),
    }).subscribe({
      next: ({ staffResponse, dailyWorkResponse, paymentResponse }) => {
        const staffs = staffResponse?.staffs || [];
        const dailyWorks = dailyWorkResponse?.dailyWorks || [];
        const payments = paymentResponse?.payments || [];
        this.staffOptions = staffs;

        const selectedStaffId = `${this.filters.staff || ""}`.trim();
        const rows = staffs
          .filter((staff: any) => !selectedStaffId || staff._id === selectedStaffId)
          .map((staff: any) => ({
            staffId: staff._id,
            name: staff.name,
            workType: staff.workType,
            earned: 0,
            advance: 0,
            payment: 0,
            payable: 0,
            workEntries: 0,
          }));

        const byId = rows.reduce((acc: Record<string, any>, row: any) => {
          acc[row.staffId] = row;
          return acc;
        }, {});

        dailyWorks.forEach((row: any) => {
          const staffId = row?.staff?._id || row?.staff;
          if (!byId[staffId]) return;
          byId[staffId].earned += Number(row?.earnedAmount || 0);
          byId[staffId].workEntries += 1;
        });

        payments.forEach((row: any) => {
          const staffId = row?.staff?._id || row?.staff;
          if (!byId[staffId]) return;
          const amount = Number(row?.amount || 0);
          if (`${row?.entryType || ""}` === "ADVANCE") {
            byId[staffId].advance += amount;
          } else {
            byId[staffId].payment += amount;
          }
        });

        this.rows = Object.values(byId).map((row: any) => ({
          ...row,
          payable: row.earned - row.advance - row.payment,
        })).sort((a: any, b: any) => b.payable - a.payable);

        this.summary = {
          totalEarned: this.rows.reduce((sum, row) => sum + row.earned, 0),
          totalAdvance: this.rows.reduce((sum, row) => sum + row.advance, 0),
          totalPayment: this.rows.reduce((sum, row) => sum + row.payment, 0),
          totalPayable: this.rows.reduce((sum, row) => sum + row.payable, 0),
        };

        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || "Failed to load staff summary", "Close", { duration: 2500 });
      },
    });
  }

  resetFilters(): void {
    this.filters = {
      search: "",
      staff: "",
      dateFrom: this.formatDate(new Date()),
      dateTo: this.formatDate(new Date()),
    };
    this.loadReport();
  }

  trackByRow(index: number, item: any): string {
    return `${item?.staffId || "row"}-${index}`;
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}
