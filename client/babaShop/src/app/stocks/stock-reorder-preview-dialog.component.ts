import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

@Component({
  selector: "app-stock-reorder-preview-dialog",
  templateUrl: "./stock-reorder-preview-dialog.component.html",
  styleUrls: ["./stock-reorder-preview-dialog.component.css"],
})
export class StockReorderPreviewDialogComponent {
  rows: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<StockReorderPreviewDialogComponent>,
  ) {
    this.rows = Array.isArray(data?.rows) ? data.rows : [];
  }

  toggleAll(selected: boolean): void {
    this.rows = this.rows.map((r) => ({ ...r, selected }));
  }

  get allSelected(): boolean {
    return this.rows.length > 0 && this.rows.every((r) => !!r.selected);
  }

  get selectedCount(): number {
    return this.rows.filter((r) => !!r.selected).length;
  }

  get totalQty(): number {
    return this.rows
      .filter((r) => !!r.selected)
      .reduce((acc, r) => acc + Math.max(1, Number(r?.suggestedQty || 1)), 0);
  }

  close(): void {
    this.dialogRef.close({ confirmed: false });
  }

  confirm(): void {
    const sanitized = this.rows.map((r) => ({
      ...r,
      suggestedQty: Math.max(1, Number(r?.suggestedQty || 1)),
    }));
    this.dialogRef.close({ confirmed: true, rows: sanitized });
  }
}
