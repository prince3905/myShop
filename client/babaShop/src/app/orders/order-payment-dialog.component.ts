import { Component, Inject, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { OrderService } from "app/shared/services/order.service";

@Component({
  selector: "app-order-payment-dialog",
  templateUrl: "./order-payment-dialog.component.html",
  styleUrls: ["./order-payment-dialog.component.css"],
})
export class OrderPaymentDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;
  readonly methods = ["CASH", "UPI", "CARD", "ONLINE", "BANK_TRANSFER"];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<OrderPaymentDialogComponent>,
    private fb: FormBuilder,
    private orderService: OrderService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const dueAmount = Number(this.data?.order?.dueAmount || 0);
    this.form = this.fb.group({
      amount: [dueAmount, [Validators.required, Validators.min(0.01)]],
      paymentMethod: [this.data?.order?.paymentMethod || "CASH", Validators.required],
      note: [""],
    });
    this.form.get("amount")?.valueChanges.subscribe(() => this.clampAmount());
  }

  submit(): void {
    if (this.saving || this.form.invalid) return;
    const amount = Number(this.form.value?.amount || 0);
    const dueAmount = Number(this.data?.order?.dueAmount || 0);
    if (amount <= 0 || amount > dueAmount) {
      this.snackBar.open("Payment amount should be more than 0 and within due amount", "Close", {
        duration: 2800,
      });
      return;
    }

    this.saving = true;

    this.orderService
      .collectOrderPayment(this.data?.order?._id, {
        amount,
        paymentMethod: this.form.value?.paymentMethod || "CASH",
        note: this.form.value?.note || "",
      })
      .subscribe({
        next: (res: any) => {
          this.saving = false;
          this.snackBar.open(res?.message || "Order payment collected", "Close", { duration: 2200 });
          this.dialogRef.close(res?.order || true);
        },
        error: (err) => {
          this.saving = false;
          this.snackBar.open(err?.error?.message || "Failed to collect order payment", "Close", {
            duration: 3200,
          });
        },
      });
  }

  private clampAmount(): void {
    const dueAmount = Number(this.data?.order?.dueAmount || 0);
    const amount = Math.max(0, Number(this.form.get("amount")?.value || 0));
    this.form.patchValue({ amount: Math.min(amount, dueAmount) || null }, { emitEvent: false });
  }
}
