import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SalesService } from "app/shared/services/sales.service";

@Component({
  selector: "app-sale-payment-dialog",
  templateUrl: "./sale-payment-dialog.component.html",
  styleUrls: ["./sale-payment-dialog.component.css"],
})
export class SalePaymentDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;
  dueAmount = 0;
  readonly methods = ["CASH", "BANK", "ONLINE", "UPI", "CARD", "CHEQUE"];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<SalePaymentDialogComponent>,
    private fb: FormBuilder,
    private salesService: SalesService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.dueAmount = Math.max(0, Number(this.data?.sale?.dueAmount || 0));
    this.form = this.fb.group({
      amount: [this.dueAmount, [Validators.required, Validators.min(0.01)]],
      paymentMethod: ["CASH", Validators.required],
      note: [""],
    });
    this.form.get("amount")?.valueChanges.subscribe(() => this.clampAmount());
  }

  submit(): void {
    if (this.saving) return;
    const amount = Math.max(0, Number(this.form.value?.amount || 0));
    if (amount <= 0) {
      this.snackBar.open("Enter a valid payment amount", "Close", { duration: 2500 });
      return;
    }
    if (amount > this.dueAmount) {
      this.snackBar.open("Payment cannot exceed due amount", "Close", { duration: 3000 });
      return;
    }

    this.saving = true;
    this.salesService
      .collectSalePayment(this.data?.sale?._id, {
        amount,
        paymentMethod: this.form.value?.paymentMethod || "CASH",
        note: this.form.value?.note || "",
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.snackBar.open("Payment collected", "Close", { duration: 2200 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.saving = false;
          this.snackBar.open(err?.error?.message || "Failed to collect payment", "Close", {
            duration: 3200,
          });
        },
      });
  }

  private clampAmount(): void {
    const amount = Math.max(0, Number(this.form.get("amount")?.value || 0));
    this.form.patchValue({ amount: Math.min(amount, this.dueAmount) || null }, { emitEvent: false });
  }
}
