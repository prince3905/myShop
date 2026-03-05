import { Component } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";

export interface LabelPrintOptions {
  quantity: number;
  size: "50x30" | "38x25";
}

@Component({
  selector: "app-label-print-options-dialog",
  templateUrl: "./label-print-options-dialog.component.html",
})
export class LabelPrintOptionsDialogComponent {
  options: LabelPrintOptions = {
    quantity: 10,
    size: "50x30",
  };

  constructor(public dialogRef: MatDialogRef<LabelPrintOptionsDialogComponent>) {}

  submit(): void {
    const quantity = Math.max(1, Math.min(500, Number(this.options.quantity || 1)));
    this.dialogRef.close({
      quantity,
      size: this.options.size,
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
