import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { AuthService } from "app/shared/services/auth.service";
import { ApiEndpointService } from "app/shared/services/api-endpoint.service";
import { ConnectivityService } from "app/shared/services/connectivity.service";
import { ApiMode } from "app/shared/config/api-endpoint.config";

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
  featureRegistry: Array<{ module: string; features: Array<{ key: string; label: string }> }> = [];
  roleFeaturePolicy: Record<string, string[]> = {};
  editableRoles: string[] = [];
  editableRoleFeaturePolicy: Record<string, string[]> = {};
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
  savingRoleAccess = false;
  runningBackup = false;
  deactivatingAccount = false;
  deactivatingShop = false;
  apiModeOptions = this.apiEndpointService.apiModeOptions;
  apiMode: ApiMode = "auto";
  customApiURL = "";
  activeApiURL = "";
  serverReachable: boolean | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private router: Router,
    private apiEndpointService: ApiEndpointService,
    private connectivityService: ConnectivityService,
  ) {}

  private showMessage(message: string): void {
    this.snackBar.open(message, "Close", { duration: 3000 });
  }

  private setLoadingState(key: keyof SettingsComponent, value: boolean): void {
    (this[key] as boolean) = value;
  }

  private handleRequest(options: {
    stateKey: keyof SettingsComponent;
    request$: any;
    successMessage: string;
    errorMessage: string;
    onSuccess?: (res?: any) => void;
    onError?: () => void;
  }): void {
    this.setLoadingState(options.stateKey, true);

    options.request$.subscribe({
      next: (res: any) => {
        this.setLoadingState(options.stateKey, false);
        this.showMessage(res?.message || options.successMessage);
        options.onSuccess?.(res);
      },
      error: (err: any) => {
        this.setLoadingState(options.stateKey, false);
        options.onError?.();
        this.showMessage(err?.error?.message || options.errorMessage);
      },
    });
  }

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
      upiId: [""],
      upiDisplayName: [""],
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
    this.loadApiSettings();
    this.connectivityService.startMonitoring();
    this.connectivityService.serverReachable$.subscribe((reachable) => {
      this.serverReachable = reachable;
    });
    this.connectivityService.activeApiURL$.subscribe((url) => {
      this.activeApiURL = url;
    });
  }

  setSection(section: string) {
    this.activeSection = section;
  }

  loadApiSettings(): void {
    const settings = this.apiEndpointService.getSettings();
    this.apiMode = settings.apiMode;
    this.customApiURL = settings.customApiURL;
    this.activeApiURL = settings.activeApiURL;
  }

  onApiModeChange(): void {
    if (this.apiMode !== "custom") {
      this.applyApiSettings();
    }
  }

  applyApiSettings(): void {
    const result = this.apiEndpointService.saveSettings(this.apiMode, this.customApiURL);
    if (!result.success) {
      this.showMessage("Custom API URL required");
      return;
    }

    this.customApiURL = this.apiMode === "custom" || this.apiMode === "ngrok"
      ? this.apiEndpointService.normalizeCustomURL(this.customApiURL)
      : this.customApiURL;
    this.activeApiURL = result.resolvedURL;
    this.connectivityService.checkNow();
    this.showMessage("API endpoint updated");
  }

  resetApiSettings(): void {
    this.apiEndpointService.clearOverride();
    this.loadApiSettings();
    this.connectivityService.checkNow();
    this.showMessage("API mode reset to auto");
  }

  get diagnosticsRows(): Array<{ label: string; value: string; tone?: string }> {
    const user = this.authService.getCurrentUser() || {};
    const selectedShopLabel = this.shopContext?.name
      || user?.shopName
      || user?.shopCode
      || (user?.shop ? "Selected shop active" : "No shop selected");
    const appMode =
      typeof window !== "undefined" && typeof (window as any).Capacitor !== "undefined"
        ? "Native / Capacitor"
        : "Web Browser";

    return [
      {
        label: "Connection",
        value: this.serverReachable === true ? "Online" : (this.serverReachable === false ? "Offline" : "Checking"),
        tone: this.serverReachable === true ? "online" : (this.serverReachable === false ? "offline" : "checking"),
      },
      { label: "API Mode", value: this.apiModeOptions.find((option) => option.value === this.apiMode)?.label || "Auto" },
      { label: "Active API", value: this.activeApiURL || "-" },
      { label: "Role", value: user?.role || "-" },
      { label: "Selected Shop", value: selectedShopLabel },
      { label: "Shop Code", value: user?.shopCode || this.shopContext?.shopCode || "-" },
      { label: "App Mode", value: appMode },
      { label: "Current Route", value: this.router.url || "/settings" },
    ];
  }

  retryApiConnection(): void {
    this.connectivityService.checkNow();
  }

  private cloneRoleFeaturePolicy(policy: Record<string, string[]> = {}): Record<string, string[]> {
    return Object.keys(policy || {}).reduce((acc, role) => {
      acc[role] = [...(policy[role] || [])];
      return acc;
    }, {} as Record<string, string[]>);
  }

  loadOverview() {
    this.loadingOverview = true;
    this.authService.getSettingsOverview().subscribe({
      next: (res: any) => {
        const data = res?.data || {};
        this.profile = data.profile || {};
        this.shopContext = data.shop || null;
        this.rolePermissions = data.rolePermissions || [];
        this.featureRegistry = data.featureRegistry || [];
        this.roleFeaturePolicy = data.roleFeaturePolicy || {};
        this.editableRoles = data.editableRoles || [];
        this.editableRoleFeaturePolicy = this.cloneRoleFeaturePolicy(this.roleFeaturePolicy);
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
          upiId: data.shop?.paymentSettings?.upiId || "",
          upiDisplayName: data.shop?.paymentSettings?.upiDisplayName || data.shop?.name || "",
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
        this.loadingOverview = false;
      },
      error: () => {
        this.loadingOverview = false;
        this.snackBar.open("Failed to load settings overview", "Close", { duration: 3000 });
      },
    });
  }

  saveProfileSettings() {
    if (this.profileForm.invalid || this.savingProfile) return;
    this.handleRequest({
      stateKey: "savingProfile",
      request$: this.authService.updateProfile(this.profileForm.value),
      successMessage: "Profile settings updated",
      errorMessage: "Failed to update profile settings",
      onSuccess: () => this.loadOverview(),
    });
  }

  saveNotificationSettings() {
    this.handleRequest({
      stateKey: "savingNotifications",
      request$: this.authService.updateNotificationSettings(this.notificationForm.value),
      successMessage: "Notification settings updated",
      errorMessage: "Failed to update notifications",
    });
  }

  savePreferences() {
    this.handleRequest({
      stateKey: "savingPreferences",
      request$: this.authService.updateAppPreferences(this.preferencesForm.value),
      successMessage: "Preferences updated",
      errorMessage: "Failed to update preferences",
    });
  }

  saveShopSettings() {
    const payload = {
      name: this.shopForm.value.name,
      contactNumber: this.shopForm.value.contactNumber,
      email: this.shopForm.value.email,
      paymentSettings: {
        upiId: this.shopForm.value.upiId,
        upiDisplayName: this.shopForm.value.upiDisplayName,
      },
      address: {
        addressLine1: this.shopForm.value.addressLine1,
        addressLine2: this.shopForm.value.addressLine2,
        city: this.shopForm.value.city,
        district: this.shopForm.value.district,
        state: this.shopForm.value.state,
        pincode: this.shopForm.value.pincode,
      },
    };
    this.handleRequest({
      stateKey: "savingShop",
      request$: this.authService.updateShopSettings(payload),
      successMessage: "Shop settings updated",
      errorMessage: "Failed to update shop settings",
      onSuccess: () => this.loadOverview(),
    });
  }

  saveIntegrations() {
    this.handleRequest({
      stateKey: "savingIntegrations",
      request$: this.authService.updateIntegrations(this.integrationForm.value),
      successMessage: "Integrations updated",
      errorMessage: "Failed to update integrations",
    });
  }

  saveBackupSettings() {
    this.handleRequest({
      stateKey: "savingBackup",
      request$: this.authService.updateBackupSettings({
        autoBackup: this.backupForm.value.autoBackup,
        frequency: this.backupForm.value.frequency,
      }),
      successMessage: "Backup settings updated",
      errorMessage: "Failed to update backup settings",
    });
  }

  runBackupNowAction() {
    this.handleRequest({
      stateKey: "runningBackup",
      request$: this.authService.runBackupNow(),
      successMessage: "Backup completed",
      errorMessage: "Failed to run backup",
      onSuccess: () => this.loadOverview(),
    });
  }

  loadAuditLogs() {
    this.loadingAudit = true;
    this.authService.getAuditLogs().subscribe({
      next: (res: any) => {
        this.auditLogs = res.logs || [];
        this.loadingAudit = false;
      },
      error: () => {
        this.loadingAudit = false;
        this.showMessage("Failed to load audit logs");
      },
    });
  }

  loadSessions() {
    this.loadingSessions = true;
    this.authService.getActiveSessions().subscribe({
      next: (res: any) => {
        this.sessions = res.sessions || [];
        this.loadingSessions = false;
      },
      error: () => {
        this.loadingSessions = false;
        this.showMessage("Failed to load active sessions");
      },
    });
  }

  onToggle2FA() {
    this.updating2FA = true;
    this.authService.updateTwoFactor(this.twoFactorEnabled).subscribe({
      next: (res: any) => {
        const user = this.authService.getCurrentUser();
        if (user) {
          user.twoFactorEnabled = this.twoFactorEnabled;
          this.authService.user = user;
        }
        this.updating2FA = false;
        this.showMessage(res?.message || "2FA updated");
      },
      error: (err) => {
        this.twoFactorEnabled = !this.twoFactorEnabled;
        this.updating2FA = false;
        this.showMessage(err?.error?.message || "Failed to update 2FA");
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
      this.showMessage("New password and confirm password must match");
      return;
    }

    this.changingPassword = true;
    this.authService.changePassword({ currentPassword, newPassword }).subscribe({
      next: (res: any) => {
        this.changingPassword = false;
        this.showMessage(res?.message || "Password changed successfully");
        this.authService.removeToken();
        this.authService.removeUser();
        this.router.navigate(["/login"]);
      },
      error: (err) => {
        this.changingPassword = false;
        this.showMessage(err?.error?.message || "Failed to change password");
      },
    });
  }

  onLogoutAllDevices() {
    if (this.loggingOutAll) return;
    this.loggingOutAll = true;
    this.authService.logoutAllDevices().subscribe({
      next: (res: any) => {
        this.loggingOutAll = false;
        this.showMessage(res?.message || "Logged out from all devices");
        this.authService.removeToken();
        this.authService.removeUser();
        this.router.navigate(["/login"]);
      },
      error: (err) => {
        this.loggingOutAll = false;
        this.showMessage(err?.error?.message || "Failed to logout all devices");
      },
    });
  }

  deactivateAccount() {
    if (this.deactivatingAccount) return;
    this.deactivatingAccount = true;
    this.authService.deactivateAccount().subscribe({
      next: (res: any) => {
        this.deactivatingAccount = false;
        this.showMessage(res?.message || "Account deactivated");
        this.authService.removeToken();
        this.authService.removeUser();
        this.router.navigate(["/login"]);
      },
      error: (err) => {
        this.deactivatingAccount = false;
        this.showMessage(err?.error?.message || "Failed to deactivate account");
      },
    });
  }

  deactivateShop() {
    if (this.deactivatingShop) return;
    this.deactivatingShop = true;
    this.authService.deactivateShop().subscribe({
      next: (res: any) => {
        this.deactivatingShop = false;
        this.showMessage(res?.message || "Shop deactivated");
        this.loadOverview();
      },
      error: (err) => {
        this.deactivatingShop = false;
        this.showMessage(err?.error?.message || "Failed to deactivate shop");
      },
    });
  }

  get policyRoles(): string[] {
    return ["STAFF", "MANAGER", "ADMIN", "SUPER_ADMIN"];
  }

  hasFeature(role: string, featureKey: string): boolean {
    const allowed = this.roleFeaturePolicy?.[role] || [];
    return allowed.includes("*") || allowed.includes(featureKey);
  }

  isEditableRole(role: string): boolean {
    return this.editableRoles.includes(role);
  }

  hasEditableFeature(role: string, featureKey: string): boolean {
    const allowed = this.editableRoleFeaturePolicy?.[role] || [];
    return allowed.includes("*") || allowed.includes(featureKey);
  }

  toggleFeature(role: string, featureKey: string, enabled: boolean): void {
    if (!this.isEditableRole(role)) {
      return;
    }

    const current = new Set(this.editableRoleFeaturePolicy?.[role] || []);
    if (enabled) {
      current.add(featureKey);
    } else {
      current.delete(featureKey);
    }

    this.editableRoleFeaturePolicy = {
      ...this.editableRoleFeaturePolicy,
      [role]: Array.from(current),
    };
  }

  resetRoleFeaturePolicy(): void {
    this.editableRoleFeaturePolicy = this.cloneRoleFeaturePolicy(this.roleFeaturePolicy);
    this.showMessage("Role access changes reset");
  }

  saveRoleFeaturePolicy(): void {
    const payload = {
      roleFeaturePolicy: this.editableRoles.reduce((acc, role) => {
        acc[role] = [...(this.editableRoleFeaturePolicy?.[role] || [])];
        return acc;
      }, {} as Record<string, string[]>),
    };

    this.handleRequest({
      stateKey: "savingRoleAccess",
      request$: this.authService.updateRoleFeaturePolicy(payload),
      successMessage: "Role access policy updated",
      errorMessage: "Failed to update role access policy",
      onSuccess: (res: any) => {
        this.roleFeaturePolicy = res?.roleFeaturePolicy || this.roleFeaturePolicy;
        this.editableRoles = res?.editableRoles || this.editableRoles;
        this.editableRoleFeaturePolicy = this.cloneRoleFeaturePolicy(this.roleFeaturePolicy);
        this.authService.authenticated().subscribe({
          next: () => {
            this.showMessage("Access updated. Page reload ho raha hai.");
            setTimeout(() => {
              window.location.reload();
            }, 600);
          },
          error: () => {},
        });
      },
    });
  }
}
