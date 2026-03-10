import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SalesService } from "app/shared/services/sales.service";

@Component({
  selector: "app-returns",
  templateUrl: "./returns.component.html",
  styleUrls: ["./returns.component.css"],
})
export class ReturnsComponent implements OnInit {
  loading = false;
  submitting = false;
  returnsLoading = false;
  invoiceId = "";
  sale: any = null;
  returns: any[] = [];
  returnsSummary: any = null;
  allReturns: any[] = [];
  saleLedger: any[] = [];

  refundMethod = "CASH";
  refundAmount = 0;
  note = "";
  refundManuallyEdited = false;

  readonly refundMethods = ["CASH", "BANK", "ONLINE", "UPI", "CARD", "STORE_CREDIT"];
  readonly reasons = ["DAMAGED", "WRONG_ITEM", "CUSTOMER_REJECTED", "WARRANTY", "OTHER"];

  constructor(
    private route: ActivatedRoute,
    private salesService: SalesService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadAllReturns();
    this.route.queryParamMap.subscribe((params) => {
      const saleId = `${params.get("saleId") || ""}`.trim();
      if (!saleId) return;
      this.invoiceId = saleId;
      this.loadSale();
    });
  }

  loadSale(): void {
    const id = `${this.invoiceId || ""}`.trim();
    if (!id) {
      this.snackBar.open("Customer return dekhne ke liye sale invoice id dalo", "Close", { duration: 2200 });
      return;
    }

    this.loading = true;
    this.salesService.getSaleById(id).subscribe({
      next: (res: any) => {
        this.sale = res?.data || null;
        if (!this.sale) {
          this.loading = false;
          this.snackBar.open("Sale invoice nahi mila", "Close", { duration: 2500 });
          return;
        }
        this.prepareReturnRows();
        this.loadReturnHistory();
      },
      error: (err) => {
        this.loading = false;
        this.sale = null;
        this.returns = [];
        this.returnsSummary = null;
        this.snackBar.open(err?.error?.message || "Failed to load sale", "Close", { duration: 3000 });
      },
    });
  }

  loadReturnHistory(): void {
    if (!this.sale?._id) {
      this.loading = false;
      return;
    }

    this.salesService.getSaleReturns(this.sale._id).subscribe({
      next: (res: any) => {
        this.returns = Array.isArray(res?.data) ? res.data : [];
        this.returnsSummary = res?.summary || null;
        this.recalculateRemainingFromHistory();
        this.refundManuallyEdited = false;
        this.syncRefundAmount();
        this.loadSaleLedger();
        this.loading = false;
        this.loadAllReturns();
      },
      error: () => {
        this.returns = [];
        this.returnsSummary = null;
        this.saleLedger = [];
        this.loading = false;
      },
    });
  }

  submitReturn(): void {
    if (!this.sale?._id) {
      this.snackBar.open("Pehle sale invoice load karo", "Close", { duration: 2200 });
      return;
    }

    const items = (this.sale.items || [])
      .map((it: any) => ({
        variationId: it?.variationId,
        variationSku: it?.variationSku,
        quantity: Number(it?.returnQty || 0),
        reason: it?.returnReason || "OTHER",
        note: it?.returnNote || "",
      }))
      .filter((it: any) => Number(it.quantity || 0) > 0);

    if (!items.length) {
      this.snackBar.open("Customer return ke liye kam se kam ek item me qty dalo", "Close", { duration: 2500 });
      return;
    }

    const total = this.calculateReturnTotal();
    const refundableMax = this.getRefundableMax();
    const refund = Math.max(0, Number(this.refundAmount || 0));
    if (refund > refundableMax) {
      this.snackBar.open(`Refund customer ko ${refundableMax.toFixed(2)} se zyada nahi ho sakta`, "Close", { duration: 2800 });
      return;
    }

    this.submitting = true;
    this.salesService
      .createSaleReturn(this.sale._id, {
        items,
        refundMethod: this.refundMethod,
        refundAmount: refund,
        note: this.note,
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.snackBar.open("Customer return saved", "Close", { duration: 2600 });
          this.loadSale();
          this.loadAllReturns();
        },
        error: (err) => {
          this.submitting = false;
          this.snackBar.open(err?.error?.message || "Failed to save customer return", "Close", {
            duration: 3200,
          });
        },
      });
  }

  calculateReturnTotal(): number {
    if (!this.sale?.items?.length) return 0;
    return Number(
      this.sale.items
        .reduce((acc: number, it: any) => {
          const qty = Number(it?.returnQty || 0);
          const price = Number(it?.sellingPrice || 0);
          return acc + qty * price;
        }, 0)
        .toFixed(2),
    );
  }

  onReturnQtyChange(item: any): void {
    const qty = Math.max(0, Number(item?.returnQty || 0));
    const remaining = Math.max(0, Number(item?.remainingQty || 0));
    item.returnQty = Math.min(qty, remaining);
    this.syncRefundAmount();
  }

  onRefundAmountInput(value: number | string): void {
    this.refundManuallyEdited = true;
    const numericValue = Math.max(0, Number(value || 0));
    this.refundAmount = Math.min(numericValue, this.getRefundableMax());
  }

  getDueAdjustPreview(): number {
    const due = Math.max(0, Number(this.sale?.dueAmount || 0));
    const total = this.calculateReturnTotal();
    return Math.min(due, total);
  }

  getRefundableMax(): number {
    const total = this.calculateReturnTotal();
    const dueAdjust = this.getDueAdjustPreview();
    return Math.max(0, Number((total - dueAdjust).toFixed(2)));
  }

  getCreditPreview(): number {
    const refundableMax = this.getRefundableMax();
    const refund = Math.max(0, Number(this.refundAmount || 0));
    return Math.max(0, Number((refundableMax - refund).toFixed(2)));
  }

  isItemReturnClosed(item: any): boolean {
    return Number(item?.remainingQty || 0) <= 0;
  }

  hasAnyReturnableItem(): boolean {
    return (this.sale?.items || []).some((it: any) => !this.isItemReturnClosed(it));
  }

  loadAllReturns(): void {
    this.returnsLoading = true;
    this.salesService.getAllSaleReturns({ page: 1, limit: 30 }).subscribe({
      next: (res: any) => {
        this.allReturns = Array.isArray(res?.data) ? res.data : [];
        this.returnsLoading = false;
      },
      error: () => {
        this.allReturns = [];
        this.returnsLoading = false;
      },
    });
  }

  loadSaleLedger(): void {
    if (!this.sale?._id) {
      this.saleLedger = [];
      return;
    }
    this.salesService.getSaleLedger(this.sale._id).subscribe({
      next: (res: any) => {
        this.saleLedger = Array.isArray(res?.data) ? res.data : [];
      },
      error: () => {
        this.saleLedger = [];
      },
    });
  }

  openReturnFromList(row: any): void {
    const saleRef = `${row?.sale?.invoiceNo || row?.sale?._id || row?.sale || ""}`.trim();
    if (!saleRef) return;
    this.invoiceId = saleRef;
    this.loadSale();
  }

  private prepareReturnRows(): void {
    this.sale.items = (this.sale.items || []).map((it: any) => ({
      ...it,
      returnedQuantity: Number(it?.returnedQuantity || 0),
      remainingQty: Math.max(0, Number(it?.quantity || 0) - Number(it?.returnedQuantity || 0)),
      returnQty: 0,
      returnReason: "OTHER",
      returnNote: "",
    }));
    this.refundMethod = "CASH";
    this.refundManuallyEdited = false;
    this.refundAmount = 0;
    this.note = "";
  }

  private recalculateRemainingFromHistory(): void {
    const returnedMap = new Map<string, number>();
    (this.returns || []).forEach((ret: any) => {
      (ret?.items || []).forEach((it: any) => {
        const key = `${it?.variationId || ""}`;
        if (!key) return;
        returnedMap.set(key, Number(returnedMap.get(key) || 0) + Number(it?.quantity || 0));
      });
    });

    this.sale.items = (this.sale.items || []).map((it: any) => {
      const key = `${it?.variationId || ""}`;
      const returnedQty = Number(returnedMap.get(key) || 0);
      const qty = Number(it?.quantity || 0);
      return {
        ...it,
        returnedQuantity: returnedQty,
        remainingQty: Math.max(0, qty - returnedQty),
        returnQty: 0,
      };
    });
    this.syncRefundAmount();
  }

  private syncRefundAmount(): void {
    const refundableMax = this.getRefundableMax();
    if (this.refundManuallyEdited) {
      this.refundAmount = Math.min(Math.max(0, Number(this.refundAmount || 0)), refundableMax);
      return;
    }
    this.refundAmount = refundableMax;
  }
}
