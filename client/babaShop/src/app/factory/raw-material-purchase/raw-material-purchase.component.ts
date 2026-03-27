import { Component, OnDestroy, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { DistributorService } from "app/shared/services/distributor.service";
import { RawMaterialPurchaseService } from "app/shared/services/raw-material-purchase.service";
import { RawMaterialService } from "app/shared/services/raw-material.service";
import { Subscription } from "rxjs";

@Component({
  selector: "app-raw-material-purchase",
  templateUrl: "./raw-material-purchase.component.html",
  styleUrls: ["./raw-material-purchase.component.css"],
})
export class RawMaterialPurchaseComponent implements OnInit {
  currentShopId: string | null = null;
  purchaseForm = {
    distributor: "",
    invoiceNo: "",
    purchaseDate: new Date(),
    paidAmount: 0,
    paymentMethod: "CASH",
    note: "",
    items: [this.createItem()],
  };

  filters = {
    search: "",
    status: "",
    distributor: "",
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
  };

  distributors: any[] = [];
  rawMaterials: any[] = [];
  purchases: any[] = [];
  summary: any = {
    totalPurchases: 0,
    pendingCount: 0,
    approvedCount: 0,
    cancelledCount: 0,
    totalValue: 0,
    totalPaid: 0,
    totalDue: 0,
    totalReceivedQty: 0,
  };

  readonly paymentMethodOptions = ["CASH", "UPI", "BANK", "ONLINE", "CARD", "CHEQUE"];

  editingPurchaseId: string | null = null;
  loading = false;
  loadingMasters = false;
  saving = false;
  approvingId: string | null = null;
  cancellingId: string | null = null;
  payingId: string | null = null;
  paymentEditorId: string | null = null;
  paymentDraft = {
    amount: 0,
    paymentMethod: "CASH",
    note: "",
  };
  userRole: string | null = null;
  private shopSubscription?: Subscription;

  constructor(
    private rawMaterialPurchaseService: RawMaterialPurchaseService,
    private rawMaterialService: RawMaterialService,
    private distributorService: DistributorService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.shopSubscription = this.authService.currentShop$.subscribe(() => {
      this.currentShopId = this.authService.getShopId();
      this.resetInvalidSelections();
      this.loadMasters();
      this.loadPurchases();
    });
  }

  ngOnDestroy(): void {
    this.shopSubscription?.unsubscribe();
  }

  get canManage(): boolean {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${this.userRole || ""}`);
  }

  createItem(): any {
    return {
      rawMaterial: "",
      quantity: 1,
      rate: 0,
      note: "",
    };
  }

  get subtotalPreview(): number {
    return (this.purchaseForm.items || []).reduce((sum, item) => {
      return sum + (Number(item?.quantity || 0) * Number(item?.rate || 0));
    }, 0);
  }

  loadMasters(): void {
    this.loadingMasters = true;
    this.distributorService.getDistributor({ page: 1, perPage: 200 }).subscribe({
      next: (res: any) => {
        this.distributors = Array.isArray(res?.distributors)
          ? res.distributors
          : Array.isArray(res?.distributor)
            ? res.distributor
            : [];
        this.ensureValidDistributorSelection();
      },
      error: () => {
        this.distributors = [];
        this.purchaseForm.distributor = "";
      },
    });

    this.rawMaterialService.getMaterials({ active: true }).subscribe({
      next: (res: any) => {
        this.rawMaterials = Array.isArray(res?.materials) ? res.materials : [];
        this.ensureValidMaterialSelections();
        this.loadingMasters = false;
      },
      error: () => {
        this.rawMaterials = [];
        this.purchaseForm.items = this.purchaseForm.items.map((item) => ({
          ...item,
          rawMaterial: "",
        }));
        this.loadingMasters = false;
      },
    });
  }

  loadPurchases(): void {
    this.loading = true;
    const params = {
      ...this.filters,
      dateFrom: this.filters.dateFrom ? this.formatDate(this.filters.dateFrom) : "",
      dateTo: this.filters.dateTo ? this.formatDate(this.filters.dateTo) : "",
    };
    this.rawMaterialPurchaseService.listPurchases(params).subscribe({
      next: (response: any) => {
        this.purchases = Array.isArray(response?.purchases) ? response.purchases : [];
        this.summary = response?.summary || this.summary;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || "Failed to load raw material purchases", "Close", { duration: 2800 });
      },
    });
  }

  addItem(): void {
    this.purchaseForm.items.push(this.createItem());
  }

  removeItem(index: number): void {
    if (this.purchaseForm.items.length <= 1) return;
    this.purchaseForm.items.splice(index, 1);
  }

  onMaterialChange(index: number): void {
    const row = this.purchaseForm.items[index];
    const selected = this.rawMaterials.find((item) => `${item?._id}` === `${row?.rawMaterial}`);
    if (!selected) return;
    row.rate = Number(selected?.currentRate || 0);
    if (!row.quantity || Number(row.quantity) <= 0) {
      row.quantity = 1;
    }
  }

  submit(form: NgForm): void {
    if (!this.canManage || this.saving || form.invalid) {
      return;
    }

    if (!this.isValidDistributorSelected()) {
      this.snackBar.open("Please select a distributor from the current shop list", "Close", { duration: 2800 });
      return;
    }

    if (!this.areValidMaterialsSelected()) {
      this.snackBar.open("Please select raw materials from the current shop list", "Close", { duration: 2800 });
      return;
    }

    const payload = {
      distributor: this.purchaseForm.distributor,
      invoiceNo: this.purchaseForm.invoiceNo,
      purchaseDate: this.formatDate(this.purchaseForm.purchaseDate),
      paidAmount: Number(this.purchaseForm.paidAmount || 0),
      paymentMethod: this.purchaseForm.paymentMethod || "CASH",
      note: this.purchaseForm.note,
      items: this.purchaseForm.items.map((item) => ({
        rawMaterial: item.rawMaterial,
        orderedQty: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
        note: item.note,
      })),
    };

    this.saving = true;
    const request$ = this.editingPurchaseId
      ? this.rawMaterialPurchaseService.updatePurchase(this.editingPurchaseId, payload)
      : this.rawMaterialPurchaseService.createPurchase(payload);

    request$.subscribe({
      next: (response: any) => {
        this.saving = false;
        this.snackBar.open(response?.message || (this.editingPurchaseId ? "Purchase updated" : "Purchase saved"), "Close", { duration: 2600 });
        this.resetForm(form);
        this.loadPurchases();
      },
      error: (error) => {
        this.saving = false;
        this.snackBar.open(error?.error?.message || "Failed to save raw material purchase", "Close", { duration: 2800 });
      },
    });
  }

  startEdit(purchase: any): void {
    if (!this.canManage || `${purchase?.status || ""}` !== "PENDING_RECEIPT") return;
    this.editingPurchaseId = purchase._id;
    this.purchaseForm = {
      distributor: purchase?.distributor?._id || purchase?.distributor || "",
      invoiceNo: purchase?.invoiceNo || "",
      purchaseDate: purchase?.purchaseDate ? new Date(purchase.purchaseDate) : new Date(),
      paidAmount: Number(purchase?.paidAmount || 0),
      paymentMethod: purchase?.paymentMethod || "CASH",
      note: purchase?.note || "",
      items: (purchase?.items || []).map((item: any) => ({
        rawMaterial: item?.rawMaterial || "",
        quantity: Number(item?.orderedQty || 0),
        rate: Number(item?.rate || 0),
        note: item?.note || "",
      })),
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  approve(purchase: any): void {
    if (!this.canManage || !purchase?._id || this.approvingId) return;
    if (!window.confirm(`Approve receipt for invoice ${purchase?.invoiceNo || purchase?._id}?`)) return;
    this.approvingId = purchase._id;
    this.rawMaterialPurchaseService.approvePurchase(purchase._id).subscribe({
      next: (response: any) => {
        this.approvingId = null;
        this.snackBar.open(response?.message || "Receipt approved", "Close", { duration: 2600 });
        this.loadPurchases();
      },
      error: (error) => {
        this.approvingId = null;
        this.snackBar.open(error?.error?.message || "Failed to approve receipt", "Close", { duration: 2800 });
      },
    });
  }

  cancelPurchase(purchase: any): void {
    if (!this.canManage || !purchase?._id || this.cancellingId) return;
    if (!window.confirm(`Cancel pending receipt for invoice ${purchase?.invoiceNo || purchase?._id}?`)) return;
    this.cancellingId = purchase._id;
    this.rawMaterialPurchaseService.cancelPurchase(purchase._id).subscribe({
      next: (response: any) => {
        this.cancellingId = null;
        this.snackBar.open(response?.message || "Purchase cancelled", "Close", { duration: 2600 });
        this.loadPurchases();
      },
      error: (error) => {
        this.cancellingId = null;
        this.snackBar.open(error?.error?.message || "Failed to cancel purchase", "Close", { duration: 2800 });
      },
    });
  }

  openPaymentEditor(purchase: any): void {
    this.paymentEditorId = purchase?._id || null;
    this.paymentDraft = {
      amount: Number(purchase?.dueAmount || 0),
      paymentMethod: "CASH",
      note: "",
    };
  }

  closePaymentEditor(): void {
    this.paymentEditorId = null;
    this.paymentDraft = {
      amount: 0,
      paymentMethod: "CASH",
      note: "",
    };
  }

  submitPayment(purchase: any): void {
    if (!this.canManage || !purchase?._id || this.payingId) return;
    const amount = Number(this.paymentDraft.amount || 0);
    if (amount <= 0) {
      this.snackBar.open("Enter valid payment amount", "Close", { duration: 2600 });
      return;
    }
    if (amount > Number(purchase?.dueAmount || 0)) {
      this.snackBar.open("Payment due amount se zyada nahi ho sakta", "Close", { duration: 2600 });
      return;
    }

    this.payingId = purchase._id;
    this.rawMaterialPurchaseService.addPayment(purchase._id, {
      amount,
      paymentMethod: this.paymentDraft.paymentMethod || "CASH",
      note: this.paymentDraft.note || "",
    }).subscribe({
      next: (response: any) => {
        this.payingId = null;
        this.snackBar.open(response?.message || "Payment added", "Close", { duration: 2600 });
        this.closePaymentEditor();
        this.loadPurchases();
      },
      error: (error) => {
        this.payingId = null;
        this.snackBar.open(error?.error?.message || "Failed to add payment", "Close", { duration: 2800 });
      },
    });
  }

  resetFilters(): void {
    this.filters = {
      search: "",
      status: "",
      distributor: "",
      dateFrom: null,
      dateTo: null,
    };
    this.loadPurchases();
  }

  resetForm(form?: NgForm): void {
    this.editingPurchaseId = null;
    this.purchaseForm = {
      distributor: "",
      invoiceNo: "",
      purchaseDate: new Date(),
      paidAmount: 0,
      paymentMethod: "CASH",
      note: "",
      items: [this.createItem()],
    };
    if (form) {
      form.resetForm(this.purchaseForm);
    }
  }

  getStatusClass(status: string): string {
    const normalized = `${status || ""}`.toUpperCase();
    if (normalized === "APPROVED") return "approved";
    if (normalized === "CANCELLED") return "cancelled";
    return "pending";
  }

  getPurchaseReceivedQty(purchase: any): number {
    return (purchase?.items || []).reduce((sum: number, item: any) => sum + Number(item?.receivedQty || 0), 0);
  }

  getDistributorNameById(id: string): string {
    const distributor = this.distributors.find((item) => `${item?._id}` === `${id}`);
    return distributor?.name || "-";
  }

  getRawMaterialNameById(id: string): string {
    const material = this.rawMaterials.find((item) => `${item?._id}` === `${id}`);
    return material?.name || "-";
  }

  private formatDate(date: Date | string | null): string {
    if (!date) return "";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "";
    const year = parsed.getFullYear();
    const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
    const day = `${parsed.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private resetInvalidSelections(): void {
    this.purchaseForm.distributor = "";
    this.purchaseForm.items = this.purchaseForm.items.map((item) => ({
      ...item,
      rawMaterial: "",
    }));
  }

  private ensureValidDistributorSelection(): void {
    if (!this.purchaseForm.distributor) return;
    const exists = this.distributors.some((item) => `${item?._id}` === `${this.purchaseForm.distributor}`);
    if (!exists) {
      this.purchaseForm.distributor = "";
    }
  }

  private ensureValidMaterialSelections(): void {
    this.purchaseForm.items = this.purchaseForm.items.map((item) => {
      const exists = this.rawMaterials.some((material) => `${material?._id}` === `${item?.rawMaterial}`);
      return exists ? item : { ...item, rawMaterial: "" };
    });
  }

  private isValidDistributorSelected(): boolean {
    return this.distributors.some((item) => `${item?._id}` === `${this.purchaseForm.distributor}`);
  }

  private areValidMaterialsSelected(): boolean {
    return this.purchaseForm.items.every((item) =>
      this.rawMaterials.some((material) => `${material?._id}` === `${item?.rawMaterial}`),
    );
  }
}
