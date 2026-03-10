import { Component, Inject, OnInit } from "@angular/core";
import { FormArray, FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { PurchaseService } from "app/shared/services/purchase.service";

@Component({
  selector: "app-purchase-return-dialog",
  templateUrl: "./purchase-return-dialog.component.html",
  styleUrls: ["./purchase-return-dialog.component.css"],
})
export class PurchaseReturnDialogComponent implements OnInit {
  form!: FormGroup;
  saving = false;
  readonly reasons = ["DAMAGED", "EXPIRED", "WRONG_ITEM", "PRICE_ISSUE", "OTHER"];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<PurchaseReturnDialogComponent>,
    private fb: FormBuilder,
    private purchaseService: PurchaseService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const rows = (this.data?.purchase?.items || []).map((it: any) =>
      this.fb.group({
        variation: [it.variation?._id || it.variation || null, Validators.required],
        sku: [it.sku || it.variation?.sku || "-"],
        model: [it.model?.name || "-"],
        purchasedQty: [Number(it.quantity || 0)],
        returnQty: [0, [Validators.min(0)]],
        reason: ["OTHER", Validators.required],
        note: [""],
      }),
    );

    this.form = this.fb.group({
      note: [""],
      items: this.fb.array(rows),
    });
  }

  get itemsArray(): FormArray {
    return this.form.get("items") as FormArray;
  }

  submit(): void {
    if (this.saving) return;

    const items = this.itemsArray.controls
      .map((ctrl) => ctrl.value)
      .filter((row) => Number(row.returnQty || 0) > 0)
      .map((row) => ({
        variation: row.variation,
        quantity: Number(row.returnQty || 0),
        reason: row.reason || "OTHER",
        note: row.note || "",
      }));

    if (!items.length) {
      this.snackBar.open("Enter return qty for at least one SKU", "Close", { duration: 2800 });
      return;
    }

    const invalid = this.itemsArray.controls.some((ctrl) => {
      const row = ctrl.value;
      const qty = Number(row.returnQty || 0);
      const max = Number(row.purchasedQty || 0);
      return qty < 0 || qty > max;
    });
    if (invalid) {
      this.snackBar.open("Distributor ko return qty purchased qty se zyada nahi ho sakti", "Close", { duration: 3000 });
      return;
    }

    this.saving = true;
    this.purchaseService
      .createPurchaseReturn(this.data.purchase._id, {
        items,
        note: this.form.value.note || "",
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.snackBar.open("Distributor return saved", "Close", { duration: 2500 });
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.saving = false;
          this.snackBar.open(err?.error?.message || "Failed to save distributor return", "Close", {
            duration: 3200,
          });
        },
      });
  }
}
