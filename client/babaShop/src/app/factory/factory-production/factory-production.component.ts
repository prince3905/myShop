import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { FactoryProductionService } from "app/shared/services/factory-production.service";

@Component({
  selector: "app-factory-production",
  templateUrl: "./factory-production.component.html",
  styleUrls: ["./factory-production.component.css"],
})
export class FactoryProductionComponent implements OnInit {
  readonly unitOptions = ["PCS", "SET", "KG", "FEET", "MTR"];

  productionForm = {
    entryDate: this.formatDate(new Date()),
    serialNo: "",
    itemName: "",
    itemDescription: "",
    rawMaterialDetails: "",
    materialCost: 0,
    labourCost: 0,
    otherCost: 0,
    qtyProduced: null as number | null,
    unitLabel: "PCS",
    wasteQty: 0,
    workersInvolved: "",
    note: "",
  };

  filters = {
    search: "",
    dateFrom: "",
    dateTo: "",
  };

  summary: any = {
    totalEntries: 0,
    totalQty: 0,
    totalCost: 0,
    totalMaterialCost: 0,
    totalLabourCost: 0,
    totalOtherCost: 0,
    todayQty: 0,
    todayEntries: 0,
    byItem: [],
  };

  productions: any[] = [];
  editingProductionId: string | null = null;
  loadingSummary = false;
  loadingProductions = false;
  savingProduction = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private factoryProductionService: FactoryProductionService,
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

  get totalCostPreview(): number {
    return Number(this.productionForm.materialCost || 0)
      + Number(this.productionForm.labourCost || 0)
      + Number(this.productionForm.otherCost || 0);
  }

  get costPerUnitPreview(): number {
    const qty = Number(this.productionForm.qtyProduced || 0);
    if (qty <= 0) return 0;
    return this.totalCostPreview / qty;
  }

  loadAll(): void {
    this.loadSummary();
    this.loadProductions();
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.factoryProductionService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load production summary");
      },
    });
  }

  loadProductions(): void {
    this.loadingProductions = true;
    this.factoryProductionService.getProductions(this.filters).subscribe({
      next: (response) => {
        this.productions = response?.productions || [];
        this.loadingProductions = false;
      },
      error: (error) => {
        this.loadingProductions = false;
        this.showError(error?.error?.message || "Failed to load production entries");
      },
    });
  }

  submitProduction(form: NgForm): void {
    if (form.invalid || this.savingProduction) {
      return;
    }

    this.savingProduction = true;
    const request$ = this.editingProductionId
      ? this.factoryProductionService.updateProduction(this.editingProductionId, this.productionForm)
      : this.factoryProductionService.createProduction(this.productionForm);

    request$.subscribe({
      next: (response) => {
        this.savingProduction = false;
        this.snackBar.open(
          response?.message || (this.editingProductionId ? "Production entry updated" : "Production entry added"),
          "Close",
          { duration: 2500 },
        );
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingProduction = false;
        this.showError(error?.error?.message || "Failed to save production entry");
      },
    });
  }

  startEdit(production: any): void {
    if (!this.canManage || !production?._id) {
      return;
    }
    this.editingProductionId = production._id;
    this.productionForm = {
      entryDate: this.formatDate(new Date(production.entryDate)),
      serialNo: production.serialNo || "",
      itemName: production.itemName || "",
      itemDescription: production.itemDescription || "",
      rawMaterialDetails: production.rawMaterialDetails || "",
      materialCost: Number(production.materialCost || 0),
      labourCost: Number(production.labourCost || 0),
      otherCost: Number(production.otherCost || 0),
      qtyProduced: Number(production.qtyProduced || 0),
      unitLabel: production.unitLabel || "PCS",
      wasteQty: Number(production.wasteQty || 0),
      workersInvolved: production.workersInvolved || "",
      note: production.note || "",
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingProductionId = null;
    this.productionForm = {
      entryDate: this.formatDate(new Date()),
      serialNo: "",
      itemName: "",
      itemDescription: "",
      rawMaterialDetails: "",
      materialCost: 0,
      labourCost: 0,
      otherCost: 0,
      qtyProduced: null,
      unitLabel: "PCS",
      wasteQty: 0,
      workersInvolved: "",
      note: "",
    };
    if (form) {
      form.resetForm(this.productionForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      dateFrom: "",
      dateTo: "",
    };
    this.loadProductions();
  }

  deleteProduction(production: any): void {
    if (!this.canManage || !production?._id || this.deletingId) {
      return;
    }
    const confirmed = window.confirm(`Delete production entry for ${production.itemName}?`);
    if (!confirmed) {
      return;
    }
    this.deletingId = production._id;
    this.factoryProductionService.deleteProduction(production._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Production entry deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete production entry");
      },
    });
  }

  getFormTitle(): string {
    return this.editingProductionId ? "Edit Production Entry" : "Add Production Entry";
  }

  getSubmitLabel(): string {
    if (this.savingProduction) {
      return this.editingProductionId ? "Updating..." : "Saving...";
    }
    return this.editingProductionId ? "Update Production Entry" : "Save Production Entry";
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
