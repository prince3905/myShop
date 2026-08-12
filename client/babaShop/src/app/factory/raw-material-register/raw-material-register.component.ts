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
  readonly defaultMaterialNameOptions = [
    "Janjir (Chain)",
    "Kunda 17N",
    "Kunda 14N",
    "Side Kada",
    "Front Handle",
    "Loha Sheet 24\"",
    "Loha Sheet 30\"",
    "Loha Sheet 35\"",
    "Loha Sheet 40\"",
    "Paint / Red Oxide",
    "Iron Rivet 4N",
    "Aluminium Rivet",
  ];

  get nameSuggestions(): string[] {
    const existing = (this.materials || []).map((m) => m.name).filter(Boolean);
    const combined = Array.from(new Set([...this.defaultMaterialNameOptions, ...existing]));
    const filterValue = (this.materialForm.name || "").toLowerCase().trim();
    if (!filterValue) return combined;
    return combined.filter((item) => item.toLowerCase().includes(filterValue));
  }

  materialForm = {
    name: "",
    code: "",
    unitLabel: "PCS",
    sizeLabel: "",
    colorLabel: "",
    openingQty: 0,
    packPrice: 0,
    pcsPerPack: 0,
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
  usageRows: any[] = [];
  historySummary: any = null;
  usageSummary: any = null;
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
    return this.authService.can("factory.raw_material_master") && !this.authService.isGlobalReadOnlyMode();
  }

  loadAll(): void {
    this.loadMaterials();
  }

  allMaterials: any[] = [];
  private searchDebounceTimer: any = null;

  loadMaterials(updateAll: boolean = true): void {
    this.loadingSummary = true;
    this.loadingMaterials = true;
    this.rawMaterialService.getMaterials(this.filters).subscribe({
      next: (response) => {
        const fetched = response?.materials || [];
        if (updateAll || !this.allMaterials.length) {
          this.allMaterials = [...fetched];
        }
        this.materials = fetched;
        this.summary = this.buildSummary(this.allMaterials.length ? this.allMaterials : this.materials);
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

  onSearchInput(): void {
    const q = (this.filters.search || "").trim().toLowerCase();
    if (this.allMaterials && this.allMaterials.length > 0) {
      if (!q) {
        this.materials = [...this.allMaterials];
      } else {
        this.materials = this.allMaterials.filter((m: any) => {
          const name = (m.name || "").toLowerCase();
          const code = (m.code || "").toLowerCase();
          const note = (m.note || "").toLowerCase();
          const color = (m.color || "").toLowerCase();
          const size = (m.size || "").toLowerCase();
          return name.includes(q) || code.includes(q) || note.includes(q) || color.includes(q) || size.includes(q);
        });
      }
    }

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.loadMaterials(false);
    }, 300);
  }

  get packPriceLabel(): string {
    const unit = (this.materialForm.unitLabel || "PCS").toUpperCase();
    if (unit === "SET") {
      return "1 Set / Guchha Ka Daam (₹)";
    }
    if (unit === "PACKET" || unit === "PKT") {
      return "1 Packet Ka Daam (₹)";
    }
    if (unit === "BOX") {
      return "1 Box / Dibba Ka Daam (₹)";
    }
    if (unit === "BAG") {
      return "1 Bori Ka Daam (₹)";
    }
    return `1 ${unit} Ka Daam (₹)`;
  }

  get pcsPerPackLabel(): string {
    const unit = (this.materialForm.unitLabel || "PCS").toUpperCase();
    if (unit === "SET") {
      return "1 Set Me Kitna Piece Hai";
    }
    if (unit === "PACKET" || unit === "PKT") {
      return "1 Packet Me Kitna Piece Hai";
    }
    if (unit === "BOX") {
      return "1 Box Me Kitna Piece Hai";
    }
    if (unit === "BAG") {
      return "1 Bori Me Kitna Piece Hai";
    }
    return `1 ${unit} Me Kitna Piece Hai`;
  }

  get countedStockLabel(): string {
    const unit = (this.materialForm.unitLabel || "PCS").toUpperCase();
    if (unit === "BAG") {
      return "Physical Counted Bags (Kitni Bori Stock Me Hai)";
    }
    if (unit === "SET") {
      return "Physical Counted Sets (Kitna Set / Guchha Stock Me Hai)";
    }
    if (unit === "PACKET" || unit === "PKT") {
      return "Physical Counted Packets (Kitna Packet Stock Me Hai)";
    }
    if (unit === "BOX") {
      return "Physical Counted Boxes (Kitna Box Stock Me Hai)";
    }
    return `Physical Counted Stock Qty (${unit})`;
  }

  get countedStockPlaceholder(): string {
    const unit = (this.materialForm.unitLabel || "PCS").toUpperCase();
    if (unit === "BAG") {
      return "e.g. 10 Bori stock me hain";
    }
    if (unit === "SET") {
      return "e.g. 10 Set / Guchha stock me hain";
    }
    if (unit === "PACKET" || unit === "PKT") {
      return "e.g. 10 Packet stock me hain";
    }
    if (unit === "BOX") {
      return "e.g. 10 Box stock me hain";
    }
    return `e.g. 500 ${unit} stock me hain`;
  }

  get countedStockPcsEquivalent(): number | null {
    const qty = Number(this.materialForm.openingQty || 0);
    const pcsPerPack = Number(this.materialForm.pcsPerPack || 0);
    const unit = (this.materialForm.unitLabel || "PCS").toUpperCase();
    if ((unit === "BAG" || unit === "SET" || unit === "PACKET" || unit === "PKT" || unit === "BOX") && pcsPerPack > 0 && qty > 0) {
      return qty * pcsPerPack;
    }
    return null;
  }

  submitMaterial(form: NgForm): void {
    if (!this.canManage || form.invalid || this.savingMaterial) {
      return;
    }

    const payload = {
      ...this.materialForm,
      openingQty: Number(this.materialForm.openingQty || 0),
    };

    this.savingMaterial = true;
    const request$ = this.editingMaterialId
      ? this.rawMaterialService.updateMaterial(this.editingMaterialId, payload)
      : this.rawMaterialService.createMaterial(payload);

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

  onPackCalcChange(): void {
    const pack = Number(this.materialForm.packPrice || 0);
    const pcs = Number(this.materialForm.pcsPerPack || 0);
    if (pack > 0 && pcs > 0) {
      this.materialForm.currentRate = Number((pack / pcs).toFixed(2));
    }
  }

  onMaterialNameChange(): void {
    const name = (this.materialForm.name || "").trim();
    if (!name) return;

    const existing = (this.materials || []).find(
      (m) => (m.name || "").toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      if (existing.code) this.materialForm.code = existing.code;
      if (existing.unitLabel) this.materialForm.unitLabel = existing.unitLabel;
      if (existing.sizeLabel) this.materialForm.sizeLabel = existing.sizeLabel;
      if (existing.colorLabel) this.materialForm.colorLabel = existing.colorLabel;
      if (existing.packPrice) this.materialForm.packPrice = existing.packPrice;
      if (existing.pcsPerPack) this.materialForm.pcsPerPack = existing.pcsPerPack;
      if (existing.currentRate) this.materialForm.currentRate = existing.currentRate;
      return;
    }

    if (!this.materialForm.code) {
      this.materialForm.code = this.generateMaterialCode(name);
    }
  }

  private generateMaterialCode(name: string): string {
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, "").trim().toUpperCase();
    const parts = clean.split(/\s+/);
    let codeStr = "";
    if (parts.length >= 2) {
      codeStr = `${parts[0].slice(0, 3)}-${parts[1].slice(0, 4)}`;
    } else if (parts[0]) {
      codeStr = parts[0].slice(0, 6);
    }
    return `RM-${codeStr}`;
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
      openingQty: Number(material.openingQty || 0),
      packPrice: Number(material.packPrice || 0),
      pcsPerPack: Number(material.pcsPerPack || 0),
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
      openingQty: 0,
      packPrice: 0,
      pcsPerPack: 0,
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
    this.usageRows = [];
    this.historySummary = null;
    this.usageSummary = null;
    this.rawMaterialService.getMaterialHistory(material._id).subscribe({
      next: (response: any) => {
        this.historyRows = Array.isArray(response?.history) ? response.history : [];
        this.usageRows = Array.isArray(response?.usageHistory) ? response.usageHistory : [];
        this.historySummary = response?.summary || null;
        this.usageSummary = response?.usageSummary || null;
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
    this.usageRows = [];
    this.historySummary = null;
    this.usageSummary = null;
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
