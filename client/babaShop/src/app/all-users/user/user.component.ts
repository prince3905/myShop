import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Subscription } from "rxjs";
import { AuthService } from "app/shared/services/auth.service";
import { ShopService } from "app/shared/services/shop.service";
import { UserService } from "app/shared/services/user.service";

@Component({
  selector: "user",
  templateUrl: "./user.component.html",
  styleUrls: ["./user.component.css"],
})
export class UserComponent implements OnInit, OnDestroy {
  users: any[] = [];
  shops: any[] = [];
  loading = false;
  saving = false;
  errorMessage = "";
  isSuperAdmin = false;
  actorRole: string = "";
  currentShopLabel = "Global";
  editingUserId: string | null = null;
  userForm: FormGroup;

  private shopSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private userService: UserService,
    private authService: AuthService,
    private shopService: ShopService,
  ) {
    this.userForm = this.fb.group({
      email: ["", [Validators.required, Validators.email]],
      phoneNo: ["", [Validators.required]],
      password: ["", [Validators.required, Validators.minLength(6)]],
      role: ["STAFF", [Validators.required]],
      shop: [null],
      isActive: [true],
    });
  }

  ngOnInit(): void {
    this.actorRole = this.authService.getUserRole() || "";
    this.isSuperAdmin = this.actorRole === "SUPER_ADMIN";

    this.updateShopLabel();
    this.applyRoleBasedDefaultRole();
    this.registerRoleChangeWatcher();

    if (this.isSuperAdmin) {
      this.loadShopsForCurrentContext();
    } else {
      this.applyFixedShopForNonSuper();
    }

    this.loadUsers();

    this.shopSub = this.shopService.selectedShop$.subscribe(() => {
      this.updateShopLabel();
      this.loadUsers();
      if (this.isSuperAdmin) {
        this.loadShopsForCurrentContext();
        if (!this.editingUserId) {
          this.applySuperAdminShopContextToForm();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.shopSub?.unsubscribe();
  }

  get allowedRoles(): string[] {
    if (this.actorRole === "SUPER_ADMIN") return ["ADMIN", "MANAGER", "STAFF"];
    if (this.actorRole === "ADMIN") return ["MANAGER", "STAFF"];
    if (this.actorRole === "MANAGER") return ["STAFF"];
    return [];
  }

  get isEditMode(): boolean {
    return !!this.editingUserId;
  }

  private updateShopLabel() {
    const user = this.authService.getCurrentUser();
    this.currentShopLabel = user?.shopCode || user?.shop || "Global";
  }

  private applyRoleBasedDefaultRole() {
    const role = this.allowedRoles[0] || "STAFF";
    this.userForm.patchValue({ role }, { emitEvent: false });
  }

  private registerRoleChangeWatcher() {
    this.userForm.get("role")?.valueChanges.subscribe(() => {
      this.syncShopValidatorsWithRole();
    });
  }

  private syncShopValidatorsWithRole() {
    const shopControl = this.userForm.get("shop");
    if (!shopControl) return;

    if (this.isSuperAdmin) {
      shopControl.setValidators([Validators.required]);
      if (!shopControl.value) {
        this.applySuperAdminShopContextToForm();
      }
    } else {
      shopControl.clearValidators();
      this.applyFixedShopForNonSuper();
    }
    shopControl.updateValueAndValidity();
  }

  private applySuperAdminShopContextToForm() {
    const selectedShop = this.authService.getShopId();
    if (selectedShop) {
      this.userForm.patchValue({ shop: selectedShop }, { emitEvent: false });
    }
  }

  private applyFixedShopForNonSuper() {
    const fixedShop = this.authService.getShopId();
    this.userForm.patchValue({ shop: fixedShop || null }, { emitEvent: false });
  }

  private loadShops() {
    this.shopService.getAllShops().subscribe({
      next: (res: any) => {
        const allShops = Array.isArray(res?.data) ? res.data : [];
        const activeShopId = this.authService.getShopId();

        // SUPER_ADMIN behavior:
        // - with selected shop => only that shop in dropdown
        // - without selected shop => global mode, show all shops
        this.shops = activeShopId
          ? allShops.filter((shop: any) => shop?._id === activeShopId)
          : allShops;

        this.syncShopValidatorsWithRole();
      },
      error: () => {
        this.snackBar.open("Failed to load shops", "Close", { duration: 2500 });
      },
    });
  }

  private loadShopsForCurrentContext() {
    this.loadShops();
  }

  loadUsers() {
    this.loading = true;
    this.errorMessage = "";

    this.userService.getUsers().subscribe({
      next: (res: any) => {
        this.users = Array.isArray(res?.data) ? res.data : [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || "Failed to load users";
      },
    });
  }

  canEditUser(row: any): boolean {
    const rowRole = row?.role;
    if (this.actorRole === "SUPER_ADMIN") return true;
    if (this.actorRole === "ADMIN") return ["MANAGER", "STAFF"].includes(rowRole);
    if (this.actorRole === "MANAGER") return rowRole === "STAFF";
    return false;
  }

  onEdit(row: any) {
    if (!this.canEditUser(row)) return;

    const shopId = row?.shop?._id || row?.shop || null;
    this.editingUserId = row?._id || null;
    this.userForm.patchValue({
      email: row?.email || "",
      phoneNo: row?.phoneNo || "",
      role: row?.role || "STAFF",
      shop: shopId,
      isActive: !!row?.isActive,
      password: "",
    });
    this.userForm.get("password")?.clearValidators();
    this.userForm.get("password")?.updateValueAndValidity();
    this.syncShopValidatorsWithRole();
  }

  canDeleteUser(row: any): boolean {
    if (this.actorRole === "SUPER_ADMIN" && row?.role !== "SUPER_ADMIN") return true;
    if (this.actorRole === "ADMIN" && row?.role === "STAFF") return true;
    return false;
  }

  onDelete(row: any) {
    if (!this.canDeleteUser(row)) return;

    if (!confirm(`Delete user ${row?.email || row?.phoneNo}? This action cannot be undone.`)) {
      return;
    }

    this.loading = true;
    this.userService.deleteUser(row._id).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.snackBar.open(res?.message || "User deleted successfully", "Close", { duration: 2500 });
        this.loadUsers();
      },
      error: (err) => {
        this.loading = false;
        this.snackBar.open(err?.error?.message || "Delete failed", "Close", { duration: 3000 });
      },
    });
  }

  cancelEdit() {
    this.editingUserId = null;
    this.userForm.reset({
      email: "",
      phoneNo: "",
      password: "",
      role: this.allowedRoles[0] || "STAFF",
      shop: this.isSuperAdmin ? this.authService.getShopId() : this.authService.getShopId(),
      isActive: true,
    });
    this.userForm.get("password")?.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.get("password")?.updateValueAndValidity();
    this.syncShopValidatorsWithRole();
  }

  submitUser() {
    if (this.userForm.invalid || this.saving) {
      this.userForm.markAllAsTouched();
      return;
    }

    const form = this.userForm.value;
    const payload: any = {
      email: form.email,
      phoneNo: form.phoneNo,
      role: form.role,
      isActive: !!form.isActive,
    };

    if (!this.isEditMode) {
      payload.password = form.password;
    }

    if (this.isSuperAdmin) {
      payload.shop = form.shop;
    } else {
      payload.shop = this.authService.getShopId();
    }

    this.saving = true;
    const req$ = this.isEditMode
      ? this.userService.updateUser(this.editingUserId!, payload)
      : this.userService.createUser(payload);

    req$.subscribe({
      next: (res: any) => {
        this.saving = false;
        this.snackBar.open(
          res?.message || (this.isEditMode ? "User updated successfully" : "User created successfully"),
          "Close",
          { duration: 2500 },
        );
        this.cancelEdit();
        this.loadUsers();
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(err?.error?.message || "Operation failed", "Close", { duration: 3000 });
      },
    });
  }
}
