import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { StaffService } from "app/shared/services/staff.service";

@Component({
  selector: "app-staff-master",
  templateUrl: "./staff-master.component.html",
  styleUrls: ["./staff-master.component.css"],
})
export class StaffMasterComponent implements OnInit {
  readonly workTypes = ["Welding", "Cutting", "Fitting", "Painting", "Loading", "Helper", "Other"];
  readonly rateTypes = ["DAILY", "PIECE"];

  staffForm = {
    name: "",
    phone: "",
    workType: "Welding",
    rateType: "DAILY",
    rate: null as number | null,
    note: "",
    active: true,
  };

  filters = {
    search: "",
    workType: "",
    rateType: "",
    active: "",
  };

  summary: any = {
    totalStaffs: 0,
    totalRateBase: 0,
    activeStaffs: 0,
    inactiveStaffs: 0,
    byWorkType: [],
  };

  staffs: any[] = [];
  editingStaffId: string | null = null;
  loadingSummary = false;
  loadingStaffs = false;
  savingStaff = false;
  deletingId: string | null = null;
  userRole: string | null = null;

  constructor(
    private staffService: StaffService,
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
    this.loadStaffs();
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.staffService.getSummary().subscribe({
      next: (response) => {
        this.summary = response?.summary || this.summary;
        this.loadingSummary = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.showError(error?.error?.message || "Failed to load staff summary");
      },
    });
  }

  loadStaffs(): void {
    this.loadingStaffs = true;
    this.staffService.getStaffs(this.filters).subscribe({
      next: (response) => {
        this.staffs = response?.staffs || [];
        this.loadingStaffs = false;
      },
      error: (error) => {
        this.loadingStaffs = false;
        this.showError(error?.error?.message || "Failed to load staff list");
      },
    });
  }

  submitStaff(form: NgForm): void {
    if (form.invalid || this.savingStaff) {
      return;
    }

    this.savingStaff = true;
    const request$ = this.editingStaffId
      ? this.staffService.updateStaff(this.editingStaffId, this.staffForm)
      : this.staffService.createStaff(this.staffForm);

    request$.subscribe({
      next: (response) => {
        this.savingStaff = false;
        this.snackBar.open(response?.message || (this.editingStaffId ? "Staff updated" : "Staff added"), "Close", {
          duration: 2500,
        });
        this.cancelEdit(form);
        this.loadAll();
      },
      error: (error) => {
        this.savingStaff = false;
        this.showError(error?.error?.message || "Failed to save staff");
      },
    });
  }

  startEdit(staff: any): void {
    if (!this.canManage || !staff?._id) {
      return;
    }

    this.editingStaffId = staff._id;
    this.staffForm = {
      name: staff.name || "",
      phone: staff.phone || "",
      workType: staff.workType || "Welding",
      rateType: staff.rateType || "DAILY",
      rate: Number(staff.rate || 0),
      note: staff.note || "",
      active: !!staff.active,
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  cancelEdit(form?: NgForm): void {
    this.editingStaffId = null;
    this.staffForm = {
      name: "",
      phone: "",
      workType: "Welding",
      rateType: "DAILY",
      rate: null,
      note: "",
      active: true,
    };
    if (form) {
      form.resetForm(this.staffForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      workType: "",
      rateType: "",
      active: "",
    };
    this.loadStaffs();
  }

  deleteStaff(staff: any): void {
    if (!this.canManage || !staff?._id || this.deletingId) {
      return;
    }

    const confirmed = window.confirm(`Delete staff ${staff.name}?`);
    if (!confirmed) {
      return;
    }

    this.deletingId = staff._id;
    this.staffService.deleteStaff(staff._id).subscribe({
      next: (response) => {
        this.deletingId = null;
        this.snackBar.open(response?.message || "Staff deleted", "Close", { duration: 2500 });
        this.loadAll();
      },
      error: (error) => {
        this.deletingId = null;
        this.showError(error?.error?.message || "Failed to delete staff");
      },
    });
  }

  getFormTitle(): string {
    return this.editingStaffId ? "Edit Staff / Worker" : "Add Staff / Worker";
  }

  getSubmitLabel(): string {
    if (this.savingStaff) {
      return this.editingStaffId ? "Updating..." : "Saving...";
    }
    return this.editingStaffId ? "Update Staff / Worker" : "Save Staff / Worker";
  }

  trackBySummary(index: number, item: any): string {
    return `${item?._id || "row"}-${index}`;
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }
}
