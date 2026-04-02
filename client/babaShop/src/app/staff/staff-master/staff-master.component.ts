import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import { StaffService } from "app/shared/services/staff.service";
import { StaffWorkTypeService } from "app/shared/services/staff-work-type.service";

@Component({
  selector: "app-staff-master",
  templateUrl: "./staff-master.component.html",
  styleUrls: ["./staff-master.component.css"],
})
export class StaffMasterComponent implements OnInit {
  readonly staffTypes = ["Salesman", "Manager", "Helper", "Worker", "Supervisor", "Other"];
  readonly payBasisOptions = [
    { value: "MONTHLY", label: "Monthly Salary" },
    { value: "DAILY", label: "Daily Wage" },
    { value: "PIECE", label: "Piece / Box Rate" },
  ];

  staffForm = {
    name: "",
    phone: "",
    staffType: "Worker",
    workTypeRef: "",
    rateType: "DAILY",
    rate: null as number | null,
    note: "",
    active: true,
  };

  workTypeForm = {
    name: "",
    description: "",
    active: true,
  };

  filters = {
    search: "",
    staffType: "",
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
    byStaffType: [],
    byRateType: [],
  };

  staffs: any[] = [];
  workTypeOptions: any[] = [];
  editingStaffId: string | null = null;
  editingWorkTypeId: string | null = null;
  loadingSummary = false;
  loadingStaffs = false;
  loadingWorkTypes = false;
  savingStaff = false;
  savingWorkType = false;
  deletingId: string | null = null;
  deletingWorkTypeId: string | null = null;
  userRole: string | null = null;

  constructor(
    private staffService: StaffService,
    private staffWorkTypeService: StaffWorkTypeService,
    private snackBar: MatSnackBar,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    this.loadAll();
  }

  get canManage(): boolean {
    return this.authService.can("staff.master.manage");
  }

  get selectedPayBasisLabel(): string {
    return this.payBasisOptions.find((row) => row.value === this.staffForm.rateType)?.label || "Pay Basis";
  }

  get rateFieldLabel(): string {
    if (this.staffForm.rateType === "MONTHLY") {
      return "Monthly Salary";
    }
    if (this.staffForm.rateType === "PIECE") {
      return "Base Rate (Optional)";
    }
    return "Daily Wage";
  }

  get rateFieldHint(): string {
    if (this.staffForm.rateType === "PIECE") {
      return "Piece worker ka actual earning item rate master se aayega. Yahan 0 rakh sakte ho.";
    }
    if (this.staffForm.rateType === "MONTHLY") {
      return "Monthly salary amount enter karo.";
    }
    return "Daily wage amount enter karo.";
  }

  get canShowWorkTypeSelect(): boolean {
    return this.workTypeOptions.length > 0;
  }

  loadAll(): void {
    this.loadStaffs();
    this.loadWorkTypes();
  }

  loadStaffs(): void {
    this.loadingSummary = true;
    this.loadingStaffs = true;
    this.staffService.getStaffs(this.filters).subscribe({
      next: (response) => {
        this.staffs = response?.staffs || [];
        this.summary = this.buildSummary(this.staffs);
        this.loadingSummary = false;
        this.loadingStaffs = false;
      },
      error: (error) => {
        this.loadingSummary = false;
        this.loadingStaffs = false;
        this.showError(error?.error?.message || "Failed to load staff list");
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

  submitStaff(form: NgForm): void {
    if (form.invalid || this.savingStaff) {
      return;
    }

    if (!this.staffForm.workTypeRef) {
      this.showError("Please add or select a work type first");
      return;
    }

    this.savingStaff = true;
    const payload = {
      ...this.staffForm,
      workTypeRef: this.staffForm.workTypeRef || null,
    };

    const request$ = this.editingStaffId
      ? this.staffService.updateStaff(this.editingStaffId, payload)
      : this.staffService.createStaff(payload);

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

  onRateTypeChange(): void {
    if (this.staffForm.rateType === "PIECE" && (this.staffForm.rate === null || this.staffForm.rate === undefined)) {
      this.staffForm.rate = 0;
    }
  }

  submitWorkType(form: NgForm): void {
    if (form.invalid || this.savingWorkType || !this.canManage) {
      return;
    }

    this.savingWorkType = true;
    const request$ = this.editingWorkTypeId
      ? this.staffWorkTypeService.updateWorkType(this.editingWorkTypeId, this.workTypeForm)
      : this.staffWorkTypeService.createWorkType(this.workTypeForm);

    request$.subscribe({
      next: (response) => {
        this.savingWorkType = false;
        this.snackBar.open(response?.message || "Work type saved", "Close", { duration: 2500 });
        this.cancelWorkTypeEdit(form);
        this.loadWorkTypes();
      },
      error: (error) => {
        this.savingWorkType = false;
        this.showError(error?.error?.message || "Failed to save work type");
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
      staffType: staff.staffType || "Worker",
      workTypeRef: staff.workTypeRef?._id || staff.workTypeRef || "",
      rateType: staff.rateType || "DAILY",
      rate: Number(staff.rate || 0),
      note: staff.note || "",
      active: !!staff.active,
    };
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  startWorkTypeEdit(workType: any): void {
    if (!this.canManage || !workType?._id) {
      return;
    }

    this.editingWorkTypeId = workType._id;
    this.workTypeForm = {
      name: workType.name || "",
      description: workType.description || "",
      active: !!workType.active,
    };
  }

  cancelEdit(form?: NgForm): void {
    this.editingStaffId = null;
    this.staffForm = {
      name: "",
      phone: "",
      staffType: "Worker",
      workTypeRef: "",
      rateType: "DAILY",
      rate: null,
      note: "",
      active: true,
    };
    if (form) {
      form.resetForm(this.staffForm);
    }
  }

  cancelWorkTypeEdit(form?: NgForm): void {
    this.editingWorkTypeId = null;
    this.workTypeForm = {
      name: "",
      description: "",
      active: true,
    };
    if (form) {
      form.resetForm(this.workTypeForm);
    }
  }

  clearFilters(): void {
    this.filters = {
      search: "",
      staffType: "",
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

  deleteWorkType(workType: any): void {
    if (!this.canManage || !workType?._id || this.deletingWorkTypeId) {
      return;
    }

    const confirmed = window.confirm(`Delete work type ${workType.name}?`);
    if (!confirmed) {
      return;
    }

    this.deletingWorkTypeId = workType._id;
    this.staffWorkTypeService.deleteWorkType(workType._id).subscribe({
      next: (response) => {
        this.deletingWorkTypeId = null;
        this.snackBar.open(response?.message || "Work type deleted", "Close", { duration: 2500 });
        this.cancelWorkTypeEdit();
        this.loadWorkTypes();
      },
      error: (error) => {
        this.deletingWorkTypeId = null;
        this.showError(error?.error?.message || "Failed to delete work type");
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

  getWorkTypeSubmitLabel(): string {
    if (this.savingWorkType) {
      return this.editingWorkTypeId ? "Updating..." : "Saving...";
    }
    return this.editingWorkTypeId ? "Update Work Type" : "Save Work Type";
  }

  trackBySummary(index: number, item: any): string {
    return `${item?._id || "row"}-${index}`;
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }

  private buildSummary(staffs: any[]): any {
    const groupedBy = (rows: any[], getter: (row: any) => string) => {
      const map = rows.reduce((acc: Record<string, any>, row: any) => {
        const label = getter(row) || "Unknown";
        if (!acc[label]) {
          acc[label] = { _id: label, count: 0 };
        }
        acc[label].count += 1;
        return acc;
      }, {});
      return Object.values(map);
    };

    return {
      totalStaffs: staffs.length,
      totalRateBase: staffs.reduce((sum: number, row: any) => sum + Number(row?.rate || 0), 0),
      activeStaffs: staffs.filter((row: any) => !!row?.active).length,
      inactiveStaffs: staffs.filter((row: any) => !row?.active).length,
      byWorkType: groupedBy(staffs, (row) => row?.workType || row?.workTypeRef?.name || ""),
      byStaffType: groupedBy(staffs, (row) => row?.staffType || ""),
      byRateType: groupedBy(staffs, (row) => row?.rateType || ""),
    };
  }
}
