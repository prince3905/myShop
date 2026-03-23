import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { MaterialInwardService } from "app/shared/services/material-inward.service";
import { RawMaterialService } from "app/shared/services/raw-material.service";

@Component({
  selector: "app-material-inward",
  templateUrl: "./material-inward.component.html",
  styleUrls: ["./material-inward.component.css"],
})
export class MaterialInwardComponent implements OnInit {
  readonly paymentMethods = ["CASH", "UPI", "BANK", "CREDIT"];

  inwardForm = {
    entryDate: this.formatDate(new Date()),
    rawMaterial: "",
    unitLabel: "PCS",
    supplierName: "",
    invoiceNo: "",
    qty: null as number | null,
    rate: 0,
    paymentMethod: "CASH",
    note: "",
  };

  filters = {
    search: "",
    dateFrom: "",
    dateTo: "",
    rawMaterial: "",
  };

  summary: any = {
    totalEntries: 0,
    totalQty: 0,
    totalValue: 0,
    todayQty: 0,
    todayEntries: 0,
    todayValue: 0,
    byMaterial: [],
  };

  materials: any[] = [];
  inwards: any[] = [];
  editingInwardId: string | null = null;
  loadingSummary = false;
  loadingInwards = false;
  loadingMaterials = false;
  savingInward = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private materialInwardService: MaterialInwardService,
    private rawMaterialService: RawMaterialService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadMaterials();
    this.loadAll();
  }

  get canManage(): boolean {
    return ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(`${this.userRole || ""}`);
  }

  get totalAmountPreview(): number {
    return Number(this.inwardForm.qty || 0) * Number(this.inwardForm.rate || 0);
  }

  loadAll(): void {
    this.loadSummary();
    this.loadInwards();
  }

  loadMaterials(): void {
    this.loadingMaterials = true;
    this.rawMaterialService.getMaterials({ active: true }).subscribe({
      next: (response) => {
        this.materials = response?.materials || [];
        this.loadingMaterials = false;
      },
      error: () => {
        this.loadingMaterials = false;
      },
    });
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.materialInwardService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load material inward summary");
      },
    });
  }

  loadInwards(): void {
    this.loadingInwards = true;
    this.materialInwardService.getInwards(this.filters).subscribe({
      next: (response) => {
        this.inwards = response?.inwards || [];
        this.loadingInwards = false;
      },
      error: (error) => {
        this.loadingInwards = false;
        this.showError(error?.error?.message || "Failed to load inward entries");
      },
    });
  }

  onMaterialChange(): void {
    const selected = this.materials.find((item) => item?._id === this.inwardForm.rawMaterial);
    if (!selected) return;
    this.inwardForm.unitLabel = selected.unitLabel || "PCS";
    this.inwardForm.supplierName = selected.supplierName || "";
    this.inwardForm.rate = Number(selected.currentRate || 0);
  }

  submitInward(form: NgForm): void {
    if (form.invalid || this.savingInward) {
      return;
    }

    this.savingInward = true;
    const request$ = this.editingInwardId
      ? this.materialInwardService.updateInward(this.editingInwardId, this.inwardForm)
      : this.materialInwardService.createInward(this.inwardForm);

    request$.subscribe({
      next: (response) => {
        this.savingInward = false;
        this.snackBar.open(
          response?.message || (this.editingInwardId ? "Material inward updated" : "Material inward added"),
          "Close",
          { duration: 2500 },
        );
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingInward = false;
        this.showError(error?.error?.message || "Failed to save inward entry");
      },
    });
  }

  startEdit(inward: any): void {
    if (!this.canManage || !inward?._id) {
      return;
    }
    this.editingInwardId = inward._id;
    this.inwardForm = {
      entryDate: this.formatDate(new Date(inward.entryDate)),
      rawMaterial: inward.rawMaterial?._id || inward.rawMaterial || "",
      unitLabel: inward.unitLabel || "PCS",
      supplierName: inward.supplierName || "",
      invoiceNo: inward.invoiceNo || "",
      qty: Number(inward.qty || 0),
      rate: Number(inward.rate || 0),
      paymentMethod: inward.paymentMethod || "CASH",
      note: inward.note || "",
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingInwardId = null;
    this.inwardForm = {
      entryDate: this.formatDate(new Date()),
      rawMaterial: "",
      unitLabel: "PCS",
      supplierName: "",
      invoiceNo: "",
      qty: null,
      rate: 0,
      paymentMethod: "CASH",
      note: "",
    };
    if (form) {
      form.resetForm(this.inwardForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      dateFrom: "",
      dateTo: "",
      rawMaterial: "",
    };
    this.loadInwards();
  }

  deleteInward(inward: any): void {
    if (!this.canManage || !inward?._id || this.deletingId) {
      return;
    }
    const confirmed = window.confirm(`Delete inward entry for ${inward.materialName}?`);
    if (!confirmed) {
      return;
    }
    this.deletingId = inward._id;
    this.materialInwardService.deleteInward(inward._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Material inward deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete inward entry");
      },
    });
  }

  getFormTitle(): string {
    return this.editingInwardId ? "Edit Material Inward" : "Add Material Inward";
  }

  getSubmitLabel(): string {
    if (this.savingInward) {
      return this.editingInwardId ? "Updating..." : "Saving...";
    }
    return this.editingInwardId ? "Update Inward Entry" : "Save Inward Entry";
  }

  trackBySummary(index: number, item: any): string {
    return `${item?._id || item?.label || "row"}-${index}`;
  }

  private formatDate(date: Date): string {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }
}
