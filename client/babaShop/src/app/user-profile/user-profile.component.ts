import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";

@Component({
  selector: "app-user-profile",
  templateUrl: "./user-profile.component.html",
  styleUrls: ["./user-profile.component.css"],
})
export class UserProfileComponent implements OnInit {
  profileForm!: FormGroup;
  profileLoading = false;
  saveLoading = false;
  userProfile: any = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.profileForm = this.fb.group({
      pFname: ["", [Validators.maxLength(50)]],
      pLname: ["", [Validators.maxLength(50)]],
      pEmail: ["", [Validators.email]],
      pPhoneNo: ["", [Validators.pattern("^[0-9]{10,15}$")]],
      phoneNo: ["", [Validators.required, Validators.pattern("^[0-9]{10,15}$")]],
      role: [{ value: "", disabled: true }],
      email: [{ value: "", disabled: true }],
      shopCode: [{ value: "", disabled: true }],
      shopName: [{ value: "", disabled: true }],
      shop: [{ value: "", disabled: true }],
      mode: [{ value: "", disabled: true }],
      permissions: [{ value: "", disabled: true }],
      lastLogin: [{ value: "", disabled: true }],
      createdAt: [{ value: "", disabled: true }],
      isActive: [{ value: "", disabled: true }],
    });

    this.loadProfile();
  }

  loadProfile() {
    this.profileLoading = true;
    console.log("[FLOW][PROFILE][LOAD] request");

    this.authService.getProfile().subscribe({
      next: (res: any) => {
        this.userProfile = res.user;
        this.profileForm.patchValue({
          pFname: res.user?.pFname || "",
          pLname: res.user?.pLname || "",
          pEmail: res.user?.pEmail || "",
          pPhoneNo: res.user?.pPhoneNo || "",
          phoneNo: res.user?.phoneNo || "",
          role: res.user?.role || "",
          email: res.user?.email || "",
          shopCode: res.user?.shopCode || "GLOBAL",
          shopName: res.user?.shopName || "All Shops",
          shop: res.user?.shop || "GLOBAL",
          mode: res.user?.mode || "GLOBAL",
          permissions: (res.user?.permissions || []).join(", "),
          lastLogin: res.user?.lastLogin
            ? new Date(res.user.lastLogin).toLocaleString()
            : "Never",
          createdAt: res.user?.createdAt
            ? new Date(res.user.createdAt).toLocaleString()
            : "-",
          isActive: res.user?.isActive ? "Active" : "Disabled",
        });
        console.log("[FLOW][PROFILE][LOAD] success", {
          userId: res.user?.id,
          role: res.user?.role,
          shop: res.user?.shop,
          shopCode: res.user?.shopCode,
        });
        this.profileLoading = false;
      },
      error: (err) => {
        console.error("[FLOW][PROFILE][LOAD] error", err);
        this.profileLoading = false;
        this.snackBar.open("Failed to load profile", "Close", {
          duration: 3000,
        });
      },
    });
  }

  onSubmit() {
    if (this.profileForm.invalid || this.saveLoading) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const payload = {
      pFname: this.profileForm.get("pFname")?.value,
      pLname: this.profileForm.get("pLname")?.value,
      pEmail: this.profileForm.get("pEmail")?.value,
      pPhoneNo: this.profileForm.get("pPhoneNo")?.value,
      phoneNo: this.profileForm.get("phoneNo")?.value,
    };

    console.log("[FLOW][PROFILE][UPDATE] request", payload);
    this.saveLoading = true;

    this.authService.updateProfile(payload).subscribe({
      next: (res: any) => {
        console.log("[FLOW][PROFILE][UPDATE] success", {
          userId: res.user?.id,
          role: res.user?.role,
          shop: res.user?.shop,
          shopCode: res.user?.shopCode,
        });
        this.saveLoading = false;
        this.snackBar.open(res?.message || "Profile updated successfully", "Close", {
          duration: 3000,
        });
        this.loadProfile();
      },
      error: (err) => {
        console.error("[FLOW][PROFILE][UPDATE] error", err);
        this.saveLoading = false;
        this.snackBar.open(err?.error?.message || "Failed to update profile", "Close", {
          duration: 3000,
        });
      },
    });
  }

  get displayName(): string {
    const first = this.profileForm.get("pFname")?.value || "";
    const last = this.profileForm.get("pLname")?.value || "";
    const full = `${first} ${last}`.trim();
    return full || this.profileForm.get("email")?.value || "User";
  }

  get initials(): string {
    const first = this.profileForm.get("pFname")?.value || "";
    const last = this.profileForm.get("pLname")?.value || "";
    const chars = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    return chars || "U";
  }
}
