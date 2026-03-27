import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { RawMaterialService } from "app/shared/services/raw-material.service";

@Component({
  selector: "app-raw-material-register",
  templateUrl: "./raw-material-register.component.html",
  styleUrls: ["./raw-material-register.component.css"],
})
export class RawMaterialRegisterComponent implements OnInit {
  readonly unitOptions = ["PCS", "SET", "KG", "FEET", "MTR", "LTR", "BAG"];
  readonly defaultSizeOptions = ["30mm", "32mm", "35mm", "40mm", "45mm", "50mm", "72\"", "62\""];
  readonly defaultColorOptions = ["Red Oxide", "Black", "Silver", "Blue", "Green", "Natural"];

  materialForm = {
    name: "",
    code: "",
    unitLabel: "PCS",
    sizeLabel: "",
    colorLabel: "",
    currentRate: 0,
    note: "",
    active: true,
  };

  filters = {
    search: "",
    active: "",
  };

  summary: any = {
    totalMaterials: 0,
    activeMaterials: 0,
    inactiveMaterials: 0,
    totalReceivedQty: 0,
    totalConsumedQty: 0,
    currentBalanceQty: 0,
    currentBalanceValue: 0,
  };

  materials: any[] = [];
  selectedMaterial: any = null;
  historyRows: any[] = [];
  historySummary: any = null;
  editingMaterialId: string | null = null;
  loadingSummary = false;
  loadingMaterials = false;
  loadingHistory = false;
  savingMaterial = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private rawMaterialService: RawMaterialService,
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

  loadAll(): void {
    this.loadMaterials();
  }

  loadMaterials(): void {
    this.loadingSummary = true;
    this.loadingMaterials = true;
    this.rawMaterialService.getMaterials(this.filters).subscribe({
      next: (response) => {
        this.materials = response?.materials || [];
        this.summary = this.buildSummary(this.materials);
        this.loadingSummary = false;
        this.loadingMaterials = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.loadingMaterials = false;
        this.showError(error?.error?.message || "Failed to load raw materials");
      },
    });
  }

  submitMaterial(form: NgForm): void {
    if (form.invalid || this.savingMaterial) {
      return;
    }

    this.savingMaterial = true;
    const request$ = this.editingMaterialId
      ? this.rawMaterialService.updateMaterial(this.editingMaterialId, this.materialForm)
      : this.rawMaterialService.createMaterial(this.materialForm);

    request$.subscribe({
      next: (response) => {
        this.savingMaterial = false;
        this.snackBar.open(
          response?.message || (this.editingMaterialId ? "Raw material updated" : "Raw material added"),
          "Close",
          { duration: 2500 },
        );
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingMaterial = false;
        this.showError(error?.error?.message || "Failed to save raw material");
      },
    });
  }

  startEdit(material: any): void {
    if (!this.canManage || !material?._id) {
      return;
    }
    this.editingMaterialId = material._id;
    this.materialForm = {
      name: material.name || "",
      code: material.code || "",
      unitLabel: material.unitLabel || "PCS",
      sizeLabel: material.sizeLabel || "",
      colorLabel: material.colorLabel || "",
      currentRate: Number(material.currentRate || 0),
      note: material.note || "",
      active: !!material.active,
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingMaterialId = null;
    this.materialForm = {
      name: "",
      code: "",
      unitLabel: "PCS",
      sizeLabel: "",
      colorLabel: "",
      currentRate: 0,
      note: "",
      active: true,
    };
    if (form) {
      form.resetForm(this.materialForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      active: "",
    };
    this.loadMaterials();
  }

  viewHistory(material: any): void {
    if (!material?._id) {
      return;
    }
    this.selectedMaterial = material;
    this.loadingHistory = true;
    this.historyRows = [];
    this.historySummary = null;
    this.rawMaterialService.getMaterialHistory(material._id).subscribe({
      next: (response: any) => {
        this.historyRows = Array.isArray(response?.history) ? response.history : [];
        this.historySummary = response?.summary || null;
        this.loadingHistory = false;
      },
      error: (error) => {
        this.loadingHistory = false;
        this.showError(error?.error?.message || "Failed to load material history");
      },
    });
  }

  clearHistory(): void {
    this.selectedMaterial = null;
    this.historyRows = [];
    this.historySummary = null;
    this.loadingHistory = false;
  }

  deleteMaterial(material: any): void {
    if (!this.canManage || !material?._id || this.deletingId) {
      return;
    }
    const confirmed = window.confirm(`Delete raw material ${material.name}?`);
    if (!confirmed) {
      return;
    }
    this.deletingId = material._id;
    this.rawMaterialService.deleteMaterial(material._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Raw material deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete raw material");
      },
    });
  }

  getFormTitle(): string {
    return this.editingMaterialId ? "Edit Raw Material" : "Add Raw Material";
  }

  getSubmitLabel(): string {
    if (this.savingMaterial) {
      return this.editingMaterialId ? "Updating..." : "Saving...";
    }
    return this.editingMaterialId ? "Update Raw Material" : "Save Raw Material";
  }

  getHistoryStatusClass(status: string): string {
    const normalized = `${status || ""}`.toUpperCase();
    if (normalized === "APPROVED") return "approved";
    if (normalized === "CANCELLED") return "cancelled";
    return "pending";
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }

  private buildSummary(materials: any[]): any {
    return materials.reduce((acc: any, material: any) => {
      acc.totalMaterials += 1;
      acc.activeMaterials += material?.active ? 1 : 0;
      acc.inactiveMaterials += material?.active ? 0 : 1;
      acc.totalReceivedQty += Number(material?.receivedQty || 0);
      acc.totalConsumedQty += Number(material?.consumedQty || 0);
      acc.currentBalanceQty += Number(material?.currentBalanceQty || 0);
      acc.currentBalanceValue += Number(material?.currentBalanceValue || 0);
      return acc;
    }, {
      totalMaterials: 0,
      activeMaterials: 0,
      inactiveMaterials: 0,
      totalReceivedQty: 0,
      totalConsumedQty: 0,
      currentBalanceQty: 0,
      currentBalanceValue: 0,
    });
  }
}
