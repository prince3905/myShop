import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { StaffWorkItemService } from "app/shared/services/staff-work-item.service";
import { StaffWorkTypeService } from "app/shared/services/staff-work-type.service";

@Component({
  selector: "app-staff-work-items",
  templateUrl: "./staff-work-items.component.html",
  styleUrls: ["./staff-work-items.component.css"],
})
export class StaffWorkItemsComponent implements OnInit {
  readonly units = ["PCS", "BOX", "SET", "PAIR", "KG", "FT"];

  itemForm = {
    workTypeRef: "",
    itemName: "",
    unit: "PCS",
    pieceRate: null as number | null,
    note: "",
    active: true,
  };

  filters = {
    search: "",
    workType: "",
    active: "",
  };

  summary: any = {
    totalItems: 0,
    averageRate: 0,
    totalRateBase: 0,
    activeItems: 0,
    inactiveItems: 0,
    byWorkType: [],
  };

  workTypeOptions: any[] = [];
  items: any[] = [];
  editingItemId: string | null = null;
  loadingSummary = false;
  loadingItems = false;
  loadingWorkTypes = false;
  savingItem = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private staffWorkItemService: StaffWorkItemService,
    private staffWorkTypeService: StaffWorkTypeService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
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
    this.loadItems();
    this.loadWorkTypes();
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.staffWorkItemService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load item summary");
      },
    });
  }

  loadItems(): void {
    this.loadingItems = true;
    this.staffWorkItemService.getItems(this.filters).subscribe({
      next: (response) => {
        this.items = response?.items || [];
        this.loadingItems = false;
      },
      error: (error) => {
        this.loadingItems = false;
        this.showError(error?.error?.message || "Failed to load item rate list");
      },
    });
  }

  loadWorkTypes(): void {
    this.loadingWorkTypes = true;
    this.staffWorkTypeService.getWorkTypes({ active: true }).subscribe({
      next: (response) => {
        this.workTypeOptions = response?.workTypes || [];
        this.loadingWorkTypes = false;
      },
      error: (error) => {
        this.loadingWorkTypes = false;
        this.showError(error?.error?.message || "Failed to load work types");
      },
    });
  }

  submitItem(form: NgForm): void {
    if (form.invalid || this.savingItem) {
      return;
    }

    this.savingItem = true;
    const payload = {
      ...this.itemForm,
      workTypeRef: this.itemForm.workTypeRef || null,
    };

    const request$ = this.editingItemId
      ? this.staffWorkItemService.updateItem(this.editingItemId, payload)
      : this.staffWorkItemService.createItem(payload);

    request$.subscribe({
      next: (response) => {
        this.savingItem = false;
        this.snackBar.open(response?.message || "Work item saved", "Close", { duration: 2500 });
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingItem = false;
        this.showError(error?.error?.message || "Failed to save item rate");
      },
    });
  }

  startEdit(item: any): void {
    if (!this.canManage || !item?._id) {
      return;
    }

    this.editingItemId = item._id;
    this.itemForm = {
      workTypeRef: item.workTypeRef?._id || item.workTypeRef || "",
      itemName: item.itemName || "",
      unit: item.unit || "PCS",
      pieceRate: Number(item.pieceRate || 0),
      note: item.note || "",
      active: !!item.active,
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingItemId = null;
    this.itemForm = {
      workTypeRef: "",
      itemName: "",
      unit: "PCS",
      pieceRate: null,
      note: "",
      active: true,
    };
    if (form) {
      form.resetForm(this.itemForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      workType: "",
      active: "",
    };
    this.loadItems();
  }

  deleteItem(item: any): void {
    if (!this.canManage || !item?._id || this.deletingId) {
      return;
    }

    const confirmed = window.confirm(`Delete item rate ${item.itemName}?`);
    if (!confirmed) {
      return;
    }

    this.deletingId = item._id;
    this.staffWorkItemService.deleteItem(item._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Work item deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete item rate");
      },
    });
  }

  getFormTitle(): string {
    return this.editingItemId ? "Edit Item Rate" : "Add Item Rate";
  }

  getSubmitLabel(): string {
    if (this.savingItem) {
      return this.editingItemId ? "Updating..." : "Saving...";
    }
    return this.editingItemId ? "Update Item Rate" : "Save Item Rate";
  }

  trackBySummary(index: number, item: any): string {
    return `${item?._id || "row"}-${index}`;
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }
}
