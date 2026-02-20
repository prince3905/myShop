import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DistributorService } from '../../shared/services/distributor.service';

@Component({
  selector: 'app-view-distributor',
  templateUrl: './view-distributor.component.html',
  styleUrls: ['./view-distributor.component.css']
})
export class ViewDistributorComponent implements OnInit {

  ledger: any[] = [];
  ledgerLoading = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<ViewDistributorComponent>,
    private distributorService: DistributorService
  ) {}

  ngOnInit(): void {
    this.loadLedger();
  }

 loadLedger() {
  if (!this.data?._id) return;

  this.ledgerLoading = true;

  this.distributorService
    .getDistributorLedger(this.data._id)
    .subscribe({
      next: (res: any) => {

        // Sort oldest first
        this.ledger = (res.ledger || []).sort(
          (a: any, b: any) =>
            new Date(a.transactionDate).getTime() -
            new Date(b.transactionDate).getTime()
        );
        console.log('Ledger data:', this.ledger);
        this.ledgerLoading = false;
      },
      error: (err) => {
        console.error('Ledger fetch error:', err);
        this.ledgerLoading = false;
      }
    });
}

  close() {
    this.dialogRef.close();
  }
}