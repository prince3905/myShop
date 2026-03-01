import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { AuthService } from "app/shared/services/auth.service";

@Component({
  selector: "app-settings",
  templateUrl: "./settings.component.html",
  styleUrls: ["./settings.component.css"],
})
export class SettingsComponent implements OnInit {
  sections: string[] = [
    "Profile Settings",
    "Account Security",
    "Shop Settings",
    "Role & Permissions",
    "Notification Settings",
    "Billing & Subscription",
    "Integrations",
    "Data & Backup",
    "Audit Logs",
    "Session Management",
    "App Preferences",
    "Danger Zone",
  ];
  activeSection = "Profile Settings";

  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  notificationForm!: FormGroup;
  preferencesForm!: FormGroup;
  shopForm!: FormGroup;
  integrationForm!: FormGroup;
  backupForm!: FormGroup;

  twoFactorEnabled = false;
  sessions: any[] = [];
  rolePermissions: string[] = [];
  auditLogs: any[] = [];
  billing: any = null;
  shopContext: any = null;
  profile: any = null;

  loadingOverview = false;
  loadingSessions = false;
  loadingAudit = false;

  updating2FA = false;
  changingPassword = false;
  loggingOutAll = false;
  savingProfile = false;
  savingNotifications = false;
  savingPreferences = false;
  savingShop = false;
  savingIntegrations = false;
  savingBackup = false;
  runningBackup = false;
  deactivatingAccount = false;
  deactivatingShop = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.twoFactorEnabled = !!user?.twoFactorEnabled;

    this.profileForm = this.fb.group({
      pFname: [""],
      pLname: [""],
      pEmail: ["", [Validators.email]],
      pPhoneNo: ["", [Validators.pattern("^[0-9]{10,15}$")]],
      phoneNo: ["", [Validators.required, Validators.pattern("^[0-9]{10,15}$")]],
    });

    this.passwordForm = this.fb.group({
      currentPassword: ["", [Validators.required]],
      newPassword: ["", [Validators.required, Validators.minLength(8)]],
      confirmPassword: ["", [Validators.required]],
    });

    this.notificationForm = this.fb.group({
      email: [true],
      sms: [false],
      whatsapp: [false],
      inApp: [true],
    });

    this.preferencesForm = this.fb.group({
      language: ["en"],
      timezone: ["Asia/Kolkata"],
      currency: ["INR"],
      dateFormat: ["DD/MM/YYYY"],
    });

    this.shopForm = this.fb.group({
      name: [""],
      contactNumber: [""],
      email: [""],
      addressLine1: [""],
      addressLine2: [""],
      city: [""],
      district: [""],
      state: [""],
      pincode: [""],
    });

    this.integrationForm = this.fb.group({
      gstEnabled: [false],
      whatsappEnabled: [false],
      smsEnabled: [false],
      emailEnabled: [true],
      paymentGateway: ["NONE"],
    });

    this.backupForm = this.fb.group({
      autoBackup: [false],
      frequency: ["WEEKLY"],
      lastBackupAt: [{ value: "-", disabled: true }],
    });

    this.loadOverview();
    this.loadSessions();
    this.loadAuditLogs();
  }

  setSection(section: string) {
    this.activeSection = section;
  }

  loadOverview() {
    this.loadingOverview = true;
    console.log("[FLOW][SETTINGS][OVERVIEW] request");
    this.authService.getSettingsOverview().subscribe({
      next: (res: any) => {
        const data = res?.data || {};
        this.profile = data.profile || {};
        this.shopContext = data.shop || null;
        this.rolePermissions = data.rolePermissions || [];
        this.billing = data.shop || null;

        this.twoFactorEnabled = !!this.profile?.twoFactorEnabled;

        this.profileForm.patchValue({
          pFname: this.authService.getCurrentUser()?.pFname || "",
          pLname: this.authService.getCurrentUser()?.pLname || "",
          pEmail: this.authService.getCurrentUser()?.pEmail || "",
          pPhoneNo: this.authService.getCurrentUser()?.pPhoneNo || "",
          phoneNo: this.authService.getCurrentUser()?.phoneNo || "",
        });
        this.notificationForm.patchValue(data.notifications || {});
        this.preferencesForm.patchValue(data.preferences || {});
        this.shopForm.patchValue({
          name: data.shop?.name || "",
          contactNumber: data.shop?.contactNumber || "",
          email: data.shop?.email || "",
          addressLine1: data.shop?.address?.addressLine1 || "",
          addressLine2: data.shop?.address?.addressLine2 || "",
          city: data.shop?.address?.city || "",
          district: data.shop?.address?.district || "",
          state: data.shop?.address?.state || "",
          pincode: data.shop?.address?.pincode || "",
        });
        this.integrationForm.patchValue(data.shop?.integrationSettings || {});
        this.backupForm.patchValue({
          autoBackup: data.shop?.backupSettings?.autoBackup || false,
          frequency: data.shop?.backupSettings?.frequency || "WEEKLY",
          lastBackupAt: data.shop?.backupSettings?.lastBackupAt
            ? new Date(data.shop.backupSettings.lastBackupAt).toLocaleString()
            : "Never",
        });
        console.log("[FLOW][SETTINGS][OVERVIEW] success");
        this.loadingOverview = false;
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][OVERVIEW] error", err);
        this.loadingOverview = false;
        this.snackBar.open("Failed to load settings overview", "Close", { duration: 3000 });
      },
    });
  }

  saveProfileSettings() {
    if (this.profileForm.invalid || this.savingProfile) return;
    this.savingProfile = true;
    console.log("[FLOW][SETTINGS][PROFILE] request");
    this.authService.updateProfile(this.profileForm.value).subscribe({
      next: (res: any) => {
        this.savingProfile = false;
        this.snackBar.open(res?.message || "Profile settings updated", "Close", { duration: 3000 });
        this.loadOverview();
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][PROFILE] error", err);
        this.savingProfile = false;
        this.snackBar.open(err?.error?.message || "Failed to update profile settings", "Close", { duration: 3000 });
      },
    });
  }

  saveNotificationSettings() {
    this.savingNotifications = true;
    console.log("[FLOW][SETTINGS][NOTIFICATIONS] request", this.notificationForm.value);
    this.authService.updateNotificationSettings(this.notificationForm.value).subscribe({
      next: (res: any) => {
        this.savingNotifications = false;
        this.snackBar.open(res?.message || "Notification settings updated", "Close", { duration: 3000 });
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][NOTIFICATIONS] error", err);
        this.savingNotifications = false;
        this.snackBar.open(err?.error?.message || "Failed to update notifications", "Close", { duration: 3000 });
      },
    });
  }

  savePreferences() {
    this.savingPreferences = true;
    console.log("[FLOW][SETTINGS][PREFERENCES] request", this.preferencesForm.value);
    this.authService.updateAppPreferences(this.preferencesForm.value).subscribe({
      next: (res: any) => {
        this.savingPreferences = false;
        this.snackBar.open(res?.message || "Preferences updated", "Close", { duration: 3000 });
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][PREFERENCES] error", err);
        this.savingPreferences = false;
        this.snackBar.open(err?.error?.message || "Failed to update preferences", "Close", { duration: 3000 });
      },
    });
  }

  saveShopSettings() {
    this.savingShop = true;
    const payload = {
      name: this.shopForm.value.name,
      contactNumber: this.shopForm.value.contactNumber,
      email: this.shopForm.value.email,
      address: {
        addressLine1: this.shopForm.value.addressLine1,
        addressLine2: this.shopForm.value.addressLine2,
        city: this.shopForm.value.city,
        district: this.shopForm.value.district,
        state: this.shopForm.value.state,
        pincode: this.shopForm.value.pincode,
      },
    };
    console.log("[FLOW][SETTINGS][SHOP] request", payload);
    this.authService.updateShopSettings(payload).subscribe({
      next: (res: any) => {
        this.savingShop = false;
        this.snackBar.open(res?.message || "Shop settings updated", "Close", { duration: 3000 });
        this.loadOverview();
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][SHOP] error", err);
        this.savingShop = false;
        this.snackBar.open(err?.error?.message || "Failed to update shop settings", "Close", { duration: 3000 });
      },
    });
  }

  saveIntegrations() {
    this.savingIntegrations = true;
    console.log("[FLOW][SETTINGS][INTEGRATIONS] request", this.integrationForm.value);
    this.authService.updateIntegrations(this.integrationForm.value).subscribe({
      next: (res: any) => {
        this.savingIntegrations = false;
        this.snackBar.open(res?.message || "Integrations updated", "Close", { duration: 3000 });
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][INTEGRATIONS] error", err);
        this.savingIntegrations = false;
        this.snackBar.open(err?.error?.message || "Failed to update integrations", "Close", { duration: 3000 });
      },
    });
  }

  saveBackupSettings() {
    this.savingBackup = true;
    console.log("[FLOW][SETTINGS][BACKUP] request", this.backupForm.value);
    this.authService.updateBackupSettings({
      autoBackup: this.backupForm.value.autoBackup,
      frequency: this.backupForm.value.frequency,
    }).subscribe({
      next: (res: any) => {
        this.savingBackup = false;
        this.snackBar.open(res?.message || "Backup settings updated", "Close", { duration: 3000 });
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][BACKUP] error", err);
        this.savingBackup = false;
        this.snackBar.open(err?.error?.message || "Failed to update backup settings", "Close", { duration: 3000 });
      },
    });
  }

  runBackupNowAction() {
    this.runningBackup = true;
    console.log("[FLOW][SETTINGS][BACKUP_RUN] request");
    this.authService.runBackupNow().subscribe({
      next: (res: any) => {
        this.runningBackup = false;
        this.snackBar.open(res?.message || "Backup completed", "Close", { duration: 3000 });
        this.loadOverview();
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][BACKUP_RUN] error", err);
        this.runningBackup = false;
        this.snackBar.open(err?.error?.message || "Failed to run backup", "Close", { duration: 3000 });
      },
    });
  }

  loadAuditLogs() {
    this.loadingAudit = true;
    console.log("[FLOW][SETTINGS][AUDIT] request");
    this.authService.getAuditLogs().subscribe({
      next: (res: any) => {
        this.auditLogs = res.logs || [];
        this.loadingAudit = false;
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][AUDIT] error", err);
        this.loadingAudit = false;
        this.snackBar.open("Failed to load audit logs", "Close", { duration: 3000 });
      },
    });
  }

  loadSessions() {
    this.loadingSessions = true;
    console.log("[FLOW][SETTINGS][SESSIONS] request");
    this.authService.getActiveSessions().subscribe({
      next: (res: any) => {
        this.sessions = res.sessions || [];
        console.log("[FLOW][SETTINGS][SESSIONS] success", { count: this.sessions.length });
        this.loadingSessions = false;
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][SESSIONS] error", err);
        this.loadingSessions = false;
        this.snackBar.open("Failed to load active sessions", "Close", { duration: 3000 });
      },
    });
  }

  onToggle2FA() {
    this.updating2FA = true;
    console.log("[FLOW][SETTINGS][2FA] request", { enabled: this.twoFactorEnabled });
    this.authService.updateTwoFactor(this.twoFactorEnabled).subscribe({
      next: (res: any) => {
        console.log("[FLOW][SETTINGS][2FA] success", res);
        const user = this.authService.getCurrentUser();
        if (user) {
          user.twoFactorEnabled = this.twoFactorEnabled;
          this.authService.user = user;
        }
        this.updating2FA = false;
        this.snackBar.open(res?.message || "2FA updated", "Close", { duration: 3000 });
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][2FA] error", err);
        this.twoFactorEnabled = !this.twoFactorEnabled;
        this.updating2FA = false;
        this.snackBar.open(err?.error?.message || "Failed to update 2FA", "Close", { duration: 3000 });
      },
    });
  }

  onChangePassword() {
    if (this.passwordForm.invalid || this.changingPassword) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const currentPassword = this.passwordForm.get("currentPassword")?.value;
    const newPassword = this.passwordForm.get("newPassword")?.value;
    const confirmPassword = this.passwordForm.get("confirmPassword")?.value;

    if (newPassword !== confirmPassword) {
      this.snackBar.open("New password and confirm password must match", "Close", {
        duration: 3000,
      });
      return;
    }

    this.changingPassword = true;
    console.log("[FLOW][SETTINGS][PASSWORD] request");
    this.authService.changePassword({ currentPassword, newPassword }).subscribe({
      next: (res: any) => {
        console.log("[FLOW][SETTINGS][PASSWORD] success");
        this.changingPassword = false;
        this.snackBar.open(res?.message || "Password changed successfully", "Close", {
          duration: 3500,
        });
        this.authService.removeToken();
        this.authService.removeUser();
        this.router.navigate(["/login"]);
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][PASSWORD] error", err);
        this.changingPassword = false;
        this.snackBar.open(err?.error?.message || "Failed to change password", "Close", {
          duration: 3000,
        });
      },
    });
  }

  onLogoutAllDevices() {
    if (this.loggingOutAll) return;
    this.loggingOutAll = true;
    console.log("[FLOW][SETTINGS][LOGOUT_ALL] request");
    this.authService.logoutAllDevices().subscribe({
      next: (res: any) => {
        console.log("[FLOW][SETTINGS][LOGOUT_ALL] success");
        this.loggingOutAll = false;
        this.snackBar.open(res?.message || "Logged out from all devices", "Close", {
          duration: 3000,
        });
        this.authService.removeToken();
        this.authService.removeUser();
        this.router.navigate(["/login"]);
      },
      error: (err) => {
        console.error("[FLOW][SETTINGS][LOGOUT_ALL] error", err);
        this.loggingOutAll = false;
        this.snackBar.open(err?.error?.message || "Failed to logout all devices", "Close", {
          duration: 3000,
        });
      },
    });
  }

  deactivateAccount() {
    if (this.deactivatingAccount) return;
    this.deactivatingAccount = true;
    console.log("[FLOW][SETTINGS][DANGER][ACCOUNT] request");
    this.authService.deactivateAccount().subscribe({
      next: (res: any) => {
        this.deactivatingAccount = false;
        this.snackBar.open(res?.message || "Account deactivated", "Close", { duration: 3000 });
        this.authService.removeToken();
        this.authService.removeUser();
        this.router.navigate(["/login"]);
      },
      error: (err) => {
        this.deactivatingAccount = false;
        console.error("[FLOW][SETTINGS][DANGER][ACCOUNT] error", err);
        this.snackBar.open(err?.error?.message || "Failed to deactivate account", "Close", { duration: 3000 });
      },
    });
  }

  deactivateShop() {
    if (this.deactivatingShop) return;
    this.deactivatingShop = true;
    console.log("[FLOW][SETTINGS][DANGER][SHOP] request");
    this.authService.deactivateShop().subscribe({
      next: (res: any) => {
        this.deactivatingShop = false;
        this.snackBar.open(res?.message || "Shop deactivated", "Close", { duration: 3000 });
        this.loadOverview();
      },
      error: (err) => {
        this.deactivatingShop = false;
        console.error("[FLOW][SETTINGS][DANGER][SHOP] error", err);
        this.snackBar.open(err?.error?.message || "Failed to deactivate shop", "Close", { duration: 3000 });
      },
    });
  }
}
