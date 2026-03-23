import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { ScrapRegisterService } from "app/shared/services/scrap-register.service";

@Component({
  selector: "app-scrap-register",
  templateUrl: "./scrap-register.component.html",
  styleUrls: ["./scrap-register.component.css"],
})
export class ScrapRegisterComponent implements OnInit {
  readonly sourceTypes = ["PRODUCTION", "RAW_MATERIAL", "CUTTING", "OTHER"];
  readonly unitOptions = ["KG", "PCS", "FEET", "MTR", "SET", "BAG"];

  scrapForm = {
    entryDate: this.formatDate(new Date()),
    itemName: "",
    sourceType: "PRODUCTION",
    sourceRef: "",
    qty: null as number | null,
    unitLabel: "KG",
    estimatedValue: 0,
    note: "",
  };

  filters = {
    search: "",
    sourceType: "",
    dateFrom: "",
    dateTo: "",
  };

  summary: any = {
    totalEntries: 0,
    totalQty: 0,
    totalValue: 0,
    todayQty: 0,
    todayEntries: 0,
    bySource: [],
  };

  scraps: any[] = [];
  editingScrapId: string | null = null;
  loadingSummary = false;
  loadingScraps = false;
  savingScrap = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private scrapRegisterService: ScrapRegisterService,
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
    this.loadSummary();
    this.loadScraps();
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.scrapRegisterService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load scrap summary");
      },
    });
  }

  loadScraps(): void {
    this.loadingScraps = true;
    this.scrapRegisterService.getScraps(this.filters).subscribe({
      next: (response) => {
        this.scraps = response?.scraps || [];
        this.loadingScraps = false;
      },
      error: (error) => {
        this.loadingScraps = false;
        this.showError(error?.error?.message || "Failed to load scrap entries");
      },
    });
  }

  submitScrap(form: NgForm): void {
    if (form.invalid || this.savingScrap) {
      return;
    }

    this.savingScrap = true;
    const request$ = this.editingScrapId
      ? this.scrapRegisterService.updateScrap(this.editingScrapId, this.scrapForm)
      : this.scrapRegisterService.createScrap(this.scrapForm);

    request$.subscribe({
      next: (response) => {
        this.savingScrap = false;
        this.snackBar.open(response?.message || (this.editingScrapId ? "Scrap entry updated" : "Scrap entry added"), "Close", {
          duration: 2500,
        });
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingScrap = false;
        this.showError(error?.error?.message || "Failed to save scrap entry");
      },
    });
  }

  startEdit(scrap: any): void {
    if (!this.canManage || !scrap?._id) {
      return;
    }
    this.editingScrapId = scrap._id;
    this.scrapForm = {
      entryDate: this.formatDate(new Date(scrap.entryDate)),
      itemName: scrap.itemName || "",
      sourceType: scrap.sourceType || "PRODUCTION",
      sourceRef: scrap.sourceRef || "",
      qty: Number(scrap.qty || 0),
      unitLabel: scrap.unitLabel || "KG",
      estimatedValue: Number(scrap.estimatedValue || 0),
      note: scrap.note || "",
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingScrapId = null;
    this.scrapForm = {
      entryDate: this.formatDate(new Date()),
      itemName: "",
      sourceType: "PRODUCTION",
      sourceRef: "",
      qty: null,
      unitLabel: "KG",
      estimatedValue: 0,
      note: "",
    };
    if (form) {
      form.resetForm(this.scrapForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      sourceType: "",
      dateFrom: "",
      dateTo: "",
    };
    this.loadScraps();
  }

  deleteScrap(scrap: any): void {
    if (!this.canManage || !scrap?._id || this.deletingId) {
      return;
    }
    const confirmed = window.confirm(`Delete scrap entry for ${scrap.itemName}?`);
    if (!confirmed) {
      return;
    }
    this.deletingId = scrap._id;
    this.scrapRegisterService.deleteScrap(scrap._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Scrap entry deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete scrap entry");
      },
    });
  }

  getFormTitle(): string {
    return this.editingScrapId ? "Edit Scrap Entry" : "Add Scrap Entry";
  }

  getSubmitLabel(): string {
    if (this.savingScrap) {
      return this.editingScrapId ? "Updating..." : "Saving...";
    }
    return this.editingScrapId ? "Update Scrap Entry" : "Save Scrap Entry";
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
