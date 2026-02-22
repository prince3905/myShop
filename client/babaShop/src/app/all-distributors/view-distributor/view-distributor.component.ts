import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { LedgerEntryComponent } from "../ledger-entry/ledger-entry.component";
import { DistributorService } from "../../shared/services/distributor.service";
import { MatDialog } from "@angular/material/dialog";

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

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<ViewDistributorComponent>,
    private distributorService: DistributorService,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
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

  openLedgerModal(type: string) {
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
