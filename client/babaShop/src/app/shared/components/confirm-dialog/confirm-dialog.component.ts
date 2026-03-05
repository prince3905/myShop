import { Component, Inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";

export interface ConfirmDialogData {
  mode: "confirm" | "info";
  title: string;
  message: string;
  usage?: {
    saleCount?: number;
    orderCount?: number;
    purchaseCount?: number;
  };
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: "app-confirm-dialog",
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      <p class="dialog-message">{{ data.message }}</p>

      <div class="usage-wrap" *ngIf="data.usage">
        <div class="usage-row"><strong>Sale:</strong> {{ data.usage.saleCount || 0 }}</div>
        <div class="usage-row"><strong>Order:</strong> {{ data.usage.orderCount || 0 }}</div>
        <div class="usage-row"><strong>Purchase:</strong> {{ data.usage.purchaseCount || 0 }}</div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close(false)">
        {{ data.mode === "confirm" ? (data.cancelText || "Cancel") : "Close" }}
      </button>
      <button
        *ngIf="data.mode === 'confirm'"
        mat-flat-button
        color="warn"
        type="button"
        (click)="close(true)">
        {{ data.confirmText || "Delete" }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-message {
        margin-bottom: 10px;
        color: #333;
      }
      .usage-wrap {
        background: #fff6f6;
        border: 1px solid #f0d0d0;
        border-radius: 8px;
        padding: 10px 12px;
      }
      .usage-row {
        font-size: 13px;
        line-height: 1.5;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
  ) {}

  close(result: boolean): void {
    this.dialogRef.close(result);
  }
}

