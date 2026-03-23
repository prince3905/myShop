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

  materialForm = {
    name: "",
    code: "",
    unitLabel: "PCS",
    openingQty: 0,
    currentRate: 0,
    supplierName: "",
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
    totalOpeningQty: 0,
    totalValue: 0,
  };

  materials: any[] = [];
  editingMaterialId: string | null = null;
  loadingSummary = false;
  loadingMaterials = false;
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

  get openingValuePreview(): number {
    return Number(this.materialForm.openingQty || 0) * Number(this.materialForm.currentRate || 0);
  }

  loadAll(): void {
    this.loadSummary();
    this.loadMaterials();
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.rawMaterialService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load raw material summary");
      },
    });
  }

  loadMaterials(): void {
    this.loadingMaterials = true;
    this.rawMaterialService.getMaterials(this.filters).subscribe({
      next: (response) => {
        this.materials = response?.materials || [];
        this.loadingMaterials = false;
      },
      error: (error) => {
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
      openingQty: Number(material.openingQty || 0),
      currentRate: Number(material.currentRate || 0),
      supplierName: material.supplierName || "",
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
      openingQty: 0,
      currentRate: 0,
      supplierName: "",
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

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }
}
