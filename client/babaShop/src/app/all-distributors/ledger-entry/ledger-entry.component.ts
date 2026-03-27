import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DistributorService } from '../../shared/services/distributor.service';
import { AuthService } from 'app/shared/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PurchaseService } from 'app/shared/services/purchase.service';
import { RawMaterialPurchaseService } from 'app/shared/services/raw-material-purchase.service';
import { forkJoin } from 'rxjs';

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
    private rawMaterialPurchaseService: RawMaterialPurchaseService,
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
    forkJoin([
      this.purchaseService
        .listPurchases({
          distributor: this.data.distributorId,
          status: 'CONFIRMED',
          limit: 100,
        }),
      this.rawMaterialPurchaseService
        .listPurchases({
          distributor: this.data.distributorId,
          status: 'APPROVED',
          limit: 100,
        }),
    ]).subscribe({
      next: ([purchaseRes, rawPurchaseRes]: any[]) => {
      const purchaseRows = Array.isArray(purchaseRes?.data) ? purchaseRes.data : [];
      const rawRows = Array.isArray(rawPurchaseRes?.purchases) ? rawPurchaseRes.purchases : [];

      const normalizedPurchases = purchaseRows
        .filter((row: any) => Number(row?.dueAmount || 0) > 0)
        .map((row: any) => ({
          ...row,
          referenceType: 'PURCHASE',
          optionLabel: `${row.invoiceNo || row._id} | Due ₹${Number(row.dueAmount || 0).toFixed(2)}`,
        }));

      const normalizedRawPurchases = rawRows
        .filter((row: any) => Number(row?.dueAmount || 0) > 0)
        .map((row: any) => ({
          ...row,
          referenceType: 'RAW_MATERIAL_PURCHASE',
          optionLabel: `RM ${row.invoiceNo || row._id} | Due ₹${Number(row.dueAmount || 0).toFixed(2)}`,
        }));

      this.purchaseOptions = [...normalizedPurchases, ...normalizedRawPurchases];
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
      referenceType: this.getSelectedReferenceType(),
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

  getSelectedReferenceType(): string | undefined {
    const referenceId = `${this.form?.value?.referenceId || ""}`;
    const matched = this.purchaseOptions.find((row: any) => `${row?._id}` === referenceId);
    return matched?.referenceType || undefined;
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
