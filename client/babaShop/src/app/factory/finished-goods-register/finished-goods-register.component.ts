import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { FinishedGoodsRegisterService } from "app/shared/services/finished-goods-register.service";

@Component({
  selector: "app-finished-goods-register",
  templateUrl: "./finished-goods-register.component.html",
  styleUrls: ["./finished-goods-register.component.css"],
})
export class FinishedGoodsRegisterComponent implements OnInit {
  readonly unitOptions = ["PCS", "SET", "KG", "FEET", "MTR"];

  finishedGoodsForm = {
    entryDate: this.formatDate(new Date()),
    itemName: "",
    serialNo: "",
    batchNo: "",
    qtyReady: null as number | null,
    unitLabel: "PCS",
    estimatedUnitValue: 0,
    linkedProductionRef: "",
    note: "",
  };

  filters = {
    search: "",
    dateFrom: "",
    dateTo: "",
  };

  summary: any = {
    totalEntries: 0,
    totalQtyReady: 0,
    totalValue: 0,
    todayEntries: 0,
    todayQtyReady: 0,
    byItem: [],
  };

  finishedGoodsEntries: any[] = [];
  editingFinishedGoodsId: string | null = null;
  loadingSummary = false;
  loadingEntries = false;
  savingEntry = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private finishedGoodsRegisterService: FinishedGoodsRegisterService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadAll();
  }

  get canManage(): boolean {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${this.userRole || ""}`);
  }

  get totalEstimatedValuePreview(): number {
    return Number(this.finishedGoodsForm.qtyReady || 0) * Number(this.finishedGoodsForm.estimatedUnitValue || 0);
  }

  loadAll(): void {
    this.loadSummary();
    this.loadEntries();
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.finishedGoodsRegisterService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load finished goods summary");
      },
    });
  }

  loadEntries(): void {
    this.loadingEntries = true;
    this.finishedGoodsRegisterService.getFinishedGoods(this.filters).subscribe({
      next: (response) => {
        this.finishedGoodsEntries = response?.finishedGoods || [];
        this.loadingEntries = false;
      },
      error: (error) => {
        this.loadingEntries = false;
        this.showError(error?.error?.message || "Failed to load finished goods entries");
      },
    });
  }

  submitEntry(form: NgForm): void {
    if (form.invalid || this.savingEntry) {
      return;
    }

    this.savingEntry = true;
    const request$ = this.editingFinishedGoodsId
      ? this.finishedGoodsRegisterService.updateFinishedGoods(this.editingFinishedGoodsId, this.finishedGoodsForm)
      : this.finishedGoodsRegisterService.createFinishedGoods(this.finishedGoodsForm);

    request$.subscribe({
      next: (response) => {
        this.savingEntry = false;
        this.snackBar.open(
          response?.message || (this.editingFinishedGoodsId ? "Finished goods entry updated" : "Finished goods entry added"),
          "Close",
          { duration: 2500 },
        );
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingEntry = false;
        this.showError(error?.error?.message || "Failed to save finished goods entry");
      },
    });
  }

  startEdit(entry: any): void {
    if (!this.canManage || !entry?._id) {
      return;
    }
    this.editingFinishedGoodsId = entry._id;
    this.finishedGoodsForm = {
      entryDate: this.formatDate(new Date(entry.entryDate)),
      itemName: entry.itemName || "",
      serialNo: entry.serialNo || "",
      batchNo: entry.batchNo || "",
      qtyReady: Number(entry.qtyReady || 0),
      unitLabel: entry.unitLabel || "PCS",
      estimatedUnitValue: Number(entry.estimatedUnitValue || 0),
      linkedProductionRef: entry.linkedProductionRef || "",
      note: entry.note || "",
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingFinishedGoodsId = null;
    this.finishedGoodsForm = {
      entryDate: this.formatDate(new Date()),
      itemName: "",
      serialNo: "",
      batchNo: "",
      qtyReady: null,
      unitLabel: "PCS",
      estimatedUnitValue: 0,
      linkedProductionRef: "",
      note: "",
    };
    if (form) {
      form.resetForm(this.finishedGoodsForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      dateFrom: "",
      dateTo: "",
    };
    this.loadEntries();
  }

  deleteEntry(entry: any): void {
    if (!this.canManage || !entry?._id || this.deletingId) {
      return;
    }
    const confirmed = window.confirm(`Delete finished goods entry for ${entry.itemName}?`);
    if (!confirmed) {
      return;
    }
    this.deletingId = entry._id;
    this.finishedGoodsRegisterService.deleteFinishedGoods(entry._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Finished goods entry deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete finished goods entry");
      },
    });
  }

  getFormTitle(): string {
    return this.editingFinishedGoodsId ? "Edit Finished Goods Entry" : "Add Finished Goods Entry";
  }

  getSubmitLabel(): string {
    if (this.savingEntry) {
      return this.editingFinishedGoodsId ? "Updating..." : "Saving...";
    }
    return this.editingFinishedGoodsId ? "Update Finished Goods Entry" : "Save Finished Goods Entry";
  }

  trackBySummary(index: number, item: any): string {
    return `${item?._id || "row"}-${index}`;
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }
}
