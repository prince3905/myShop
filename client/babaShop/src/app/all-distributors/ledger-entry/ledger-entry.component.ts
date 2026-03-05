import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DistributorService } from '../../shared/services/distributor.service';
import { AuthService } from 'app/shared/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-ledger-entry',
  templateUrl: './ledger-entry.component.html',
  styleUrls: ['./ledger-entry.component.css']
})
export class LedgerEntryComponent implements OnInit {

  form!: FormGroup;
  type!: string;
  loading = false;
  canSubmit = true;
  readonly paymentModes = ["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"];

  constructor(
    private fb: FormBuilder,
    private distributorService: DistributorService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<LedgerEntryComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {

    this.type = this.data.type;

    this.form = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]],
      paymentMode: ['CASH'],
      note: ['']
    });

    // Payment ke case me paymentMode required
    if (this.type === 'payment') {
      this.form.get('paymentMode')?.setValidators([Validators.required]);
      this.form.get('paymentMode')?.updateValueAndValidity();
    }

    this.canSubmit = !(
      this.authService.getUserRole() === "SUPER_ADMIN" &&
      !this.authService.getShopId()
    );

    if (!this.canSubmit) {
      this.form.disable();
    }
  }

  submit() {

    if (!this.canSubmit) {
      this.snackBar.open("Please select a shop first", "Close", { duration: 3000 });
      return;
    }

    if (this.form.invalid) return;

    this.loading = true;

    const payload = {
      distributorId: this.data.distributorId,
      type: this.type,
      amount: this.form.value.amount,
      paymentMode: this.form.value.paymentMode,
      note: this.form.value.note
    };

    this.distributorService.createLedgerEntry(payload)
      .subscribe({
        next: () => {
          this.loading = false;
          this.dialogRef.close(true); // parent refresh karega
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
        }
      });
  }

}
