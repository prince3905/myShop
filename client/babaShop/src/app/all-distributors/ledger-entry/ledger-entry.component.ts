import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DistributorService } from '../../shared/services/distributor.service';
import { AuthService } from 'app/shared/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PurchaseService } from 'app/shared/services/purchase.service';

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
  purchaseOptions: any[] = [];
  maxAmount = 0;

  constructor(
    private fb: FormBuilder,
    private distributorService: DistributorService,
    private purchaseService: PurchaseService,
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
      referenceId: [''],
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

    if (this.type === 'payment' && this.data?.distributorId) {
      this.loadPendingPurchases();
    }

    this.form.get("referenceId")?.valueChanges.subscribe(() => this.syncPaymentLimit());
    this.form.get("amount")?.valueChanges.subscribe(() => this.clampAmountToLimit());
  }

  loadPendingPurchases(): void {
    this.purchaseService
      .listPurchases({
        distributor: this.data.distributorId,
        status: 'CONFIRMED',
        limit: 100,
      })
      .subscribe({
        next: (res: any) => {
          const rows = Array.isArray(res?.data) ? res.data : [];
          this.purchaseOptions = rows.filter((row: any) => Number(row?.dueAmount || 0) > 0);
          this.syncPaymentLimit();
        },
        error: () => {
          this.purchaseOptions = [];
        },
      });
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
      referenceId: this.form.value.referenceId || undefined,
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

  getSelectedPurchaseDue(): number {
    const referenceId = `${this.form?.value?.referenceId || ""}`;
    const matched = this.purchaseOptions.find((row: any) => `${row?._id}` === referenceId);
    return Math.max(0, Number(matched?.dueAmount || 0));
  }

  private syncPaymentLimit(): void {
    this.maxAmount = this.getSelectedPurchaseDue();
    this.clampAmountToLimit();
  }

  private clampAmountToLimit(): void {
    if (this.type !== "payment") return;
    const current = Math.max(0, Number(this.form?.get("amount")?.value || 0));
    const max = this.maxAmount;
    const safeAmount = max > 0 ? Math.min(current, max) : current;
    this.form?.patchValue({ amount: safeAmount || null }, { emitEvent: false });
  }

}
