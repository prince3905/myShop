import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { LedgerEntryComponent } from "../ledger-entry/ledger-entry.component";
import { DistributorService } from "../../shared/services/distributor.service";
import { MatDialog } from "@angular/material/dialog";
import { AuthService } from "app/shared/services/auth.service";
import { MatSnackBar } from "@angular/material/snack-bar";

@Component({
  selector: "app-view-distributor",
  templateUrl: "./view-distributor.component.html",
  styleUrls: ["./view-distributor.component.css"],
})
export class ViewDistributorComponent implements OnInit {
  ledger: any[] = [];
  ledgerLoading = false;
  totalDebit: number = 0;
  totalCredit: number = 0;
  closingBalance: number = 0;
  fromDate: string | null = null;
  toDate: string | null = null;
  originalLedger: any[] = [];
  canMutateLedger = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<ViewDistributorComponent>,
    private distributorService: DistributorService,
    private dialog: MatDialog,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.canMutateLedger = !(
      this.authService.getUserRole() === "SUPER_ADMIN" &&
      !this.authService.getShopId()
    );
    this.loadLedger();
  }

  applyDateFilter() {

  this.ledger = this.originalLedger.filter((entry) => {
    const entryDate = new Date(entry.transactionDate);

    if (this.fromDate && entryDate < new Date(this.fromDate)) {
      return false;
    }

    if (this.toDate) {
      const to = new Date(this.toDate);
      to.setHours(23,59,59,999);
      if (entryDate > to) return false;
    }

    return true;
  });

  this.calculateSummary();
}

  resetFilter() {
    this.fromDate = null;
    this.toDate = null;
    this.ledger = [...this.originalLedger];
    this.calculateSummary();
  }

  loadLedger() {
    if (!this.data?._id) return;

    this.ledgerLoading = true;

    this.distributorService.getDistributorLedger(this.data._id).subscribe({
      next: (res: any) => {
        // Sort oldest first
        this.ledger = (res.ledger || []).sort(
          (a: any, b: any) =>
            new Date(a.transactionDate).getTime() -
            new Date(b.transactionDate).getTime(),
        );
        this.ledger = this.ledger;
      this.originalLedger = [...this.ledger]; 
        this.calculateSummary();
        console.log("Distributor Details:", this.data);
        console.log("Ledger data:", this.ledger);
        this.ledgerLoading = false;
      },
      error: (err) => {
        console.error("Ledger fetch error:", err);
        this.ledgerLoading = false;
      },
    });
  }
  abs(value: number): number {
    return Math.abs(value);
  }

  printLedgerHistory(): void {
    if (!this.ledger?.length) {
      this.snackBar.open("No ledger entries to print", "Close", { duration: 2500 });
      return;
    }

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      this.snackBar.open("Popup blocked. Please allow popups to print.", "Close", {
        duration: 3000,
      });
      return;
    }

    const rows = this.ledger
      .map((entry: any) => {
        const debit =
          entry.type === "purchase" ||
          entry.type === "opening" ||
          (entry.type === "adjustment" && entry.amount > 0)
            ? `Rs ${Number(entry.amount || 0).toFixed(2)}`
            : "-";

        const credit =
          entry.type === "payment" ||
          entry.type === "purchase_return" ||
          (entry.type === "adjustment" && entry.amount < 0)
            ? `Rs ${Math.abs(Number(entry.amount || 0)).toFixed(2)}`
            : "-";
        const paymentMethod = this.resolvePaymentMethod(entry);

        return `
          <tr>
            <td>${this.formatDate(entry.transactionDate)}</td>
            <td>${this.escapeHtml(this.toTitleCase(entry.type || "-"))}</td>
            <td>${this.escapeHtml(this.toTitleCase(paymentMethod))}</td>
            <td>${this.escapeHtml(entry.note || "-")}</td>
            <td style="text-align:right;">${debit}</td>
            <td style="text-align:right;">${credit}</td>
            <td style="text-align:right;">Rs ${Number(entry.balanceAfterTransaction || 0).toFixed(2)}</td>
          </tr>
        `;
      })
      .join("");

    const dateRange = `${this.fromDate || "All"} to ${this.toDate || "All"}`;

    const html = `
      <html>
        <head>
          <title>Ledger History - ${this.escapeHtml(this.data?.name || "Distributor")}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
            h2, h3 { margin: 0 0 8px; }
            .meta { margin: 0 0 14px; color: #444; font-size: 13px; }
            .summary {
              margin: 14px 0;
              display: flex;
              flex-direction: column;
              gap: 8px;
              border: 1px solid #d7dbe2;
              border-radius: 8px;
              padding: 10px;
              background: #fff;
            }
            .summary-card {
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 10px 12px;
              background: #f9fafb;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .summary-card.balance {
              border-color: #f59e0b;
              background: #fffbeb;
            }
            .summary-label {
              font-size: 12px;
              color: #4b5563;
              letter-spacing: 0.2px;
            }
            .summary-value {
              font-size: 15px;
              font-weight: 700;
              text-align: right;
            }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
            th { background: #f5f5f5; text-align: left; }
          </style>
        </head>
        <body>
          <p class="meta">
            <b>Name:</b> ${this.escapeHtml(this.data?.name || "-")} |
            <b>Phone:</b> ${this.escapeHtml(this.data?.phone || "-")} |
            <b>Shop:</b> ${this.escapeHtml(this.data?.shop?.name || "-")}
          </p>
          <p class="meta"><b>Date Range:</b> ${this.escapeHtml(dateRange)}</p>
          <div class="summary">
            <div class="summary-card">
              <span class="summary-label">Total Debit</span>
              <span class="summary-value">Rs ${Number(this.totalDebit || 0).toFixed(2)}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">Total Credit</span>
              <span class="summary-value">Rs ${Number(this.totalCredit || 0).toFixed(2)}</span>
            </div>
            <div class="summary-card balance">
              <span class="summary-label">Closing Balance</span>
              <span class="summary-value">Rs ${Number(this.closingBalance || 0).toFixed(2)}</span>
            </div>
          </div>
          <h3>Ledger Entries</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Payment Mode</th>
                <th>Note</th>
                <th style="text-align:right;">Debit</th>
                <th style="text-align:right;">Credit</th>
                <th style="text-align:right;">Balance</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  private formatDate(value: any): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("en-IN");
  }

  private toTitleCase(value: string): string {
    return value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  resolvePaymentMethod(entry: any): string {
    const direct = `${entry?.paymentMethod || ""}`.trim().toUpperCase();
    if (direct) return direct;
    const note = `${entry?.note || ""}`.toUpperCase();
    const known = ["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"];
    for (const mode of known) {
      if (note.includes(mode)) return mode;
    }
    return "-";
  }

  openLedgerModal(type: string) {
    if (!this.canMutateLedger) {
      this.snackBar.open("Select a shop first to create ledger entry", "Close", {
        duration: 3000,
      });
      return;
    }

    const dialogRef = this.dialog.open(LedgerEntryComponent, {
      width: "500px",
      height: "600px",
      data: {
        distributorId: this.data._id,
        shopId: this.data.shop._id,
        type: type,
      },
    });

    dialogRef.afterClosed().subscribe((res) => {
      if (res) this.loadLedger();
    });
  }

  calculateSummary() {
    this.totalDebit = 0;
    this.totalCredit = 0;

    this.ledger.forEach((entry: any) => {
      // Debit types
      if (
        entry.type === "purchase" ||
        entry.type === "opening" ||
        (entry.type === "adjustment" && entry.amount > 0)
      ) {
        this.totalDebit += entry.amount;
      }

      // Credit types
      if (
        entry.type === "payment" ||
        entry.type === "purchase_return" ||
        (entry.type === "adjustment" && entry.amount < 0)
      ) {
        this.totalCredit += Math.abs(entry.amount);
      }
    });

    // Closing balance (last entry ka balance)
    if (this.ledger.length > 0) {
      this.closingBalance =
        this.ledger[this.ledger.length - 1].balanceAfterTransaction;
    }
  }

  close() {
    this.dialogRef.close();
  }
}
