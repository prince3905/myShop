import { Component, OnInit } from '@angular/core';
import { AuthService } from '../shared/services/auth.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConnectivityService } from '../shared/services/connectivity.service';

@Component({
  selector: 'login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  email: string = '';
  password: string = '';
  shopCode: string = '';
  serverReachable: boolean | null = null;
  serverStatusLabel: string = 'Checking server...';
  activeApiURL: string = '';
  readonly shopCodePattern = /^[A-Z0-9-]+$/;

  // Forgot password flow state
  authMode: 'LOGIN' | 'FORGOT_STEP1' | 'FORGOT_STEP2' = 'LOGIN';
  resetEmail: string = '';
  resetShopCode: string = '';
  resetOtp: string = '';
  resetNewPassword: string = '';
  resetConfirmPassword: string = '';
  isSubmittingForgot: boolean = false;
  isSubmittingReset: boolean = false;
  resendCountdown: number = 0;
  private resendTimerInterval: any = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private connectivityService: ConnectivityService,
  ) { }

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.connectivityService.startMonitoring();
    this.connectivityService.serverReachable$.subscribe((reachable) => {
      this.serverReachable = reachable;
      this.serverStatusLabel =
        reachable === null ? 'Checking server...' : (reachable ? 'Server connected' : 'Server offline or unreachable');
    });
    this.connectivityService.activeApiURL$.subscribe((url) => {
      this.activeApiURL = url;
    });
    this.checkServerStatus();
  }

  onSubmit(): void {
    if (!this.email || !this.password) {
      return;
    }

    if (this.shopCode && !this.shopCodePattern.test(this.shopCode)) {
      this.snackBar.open(
        'Shop code can use uppercase letters, numbers, and hyphens only.',
        'Close',
        { duration: 3500 }
      );
      return;
    }

    this.authService
      .login(this.shopCode, this.email, this.password)
      .subscribe(
        () => {
          this.router.navigate(['/dashboard']);
        },
        (error) => {
          this.snackBar.open(
            error?.error?.message || 'Login failed. Please check credentials.',
            'Close',
            { duration: 4000 }
          );
        }
      );
  }

  onShopCodeChange(value: string): void {
    if (!value) {
      this.shopCode = '';
      return;
    }
    // Only allow A-Z, 0-9 and hyphens. Convert to uppercase.
    this.shopCode = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  }

  setMode(mode: 'LOGIN' | 'FORGOT_STEP1' | 'FORGOT_STEP2'): void {
    this.authMode = mode;
    if (mode === 'FORGOT_STEP1') {
      this.resetEmail = this.email || '';
      this.resetShopCode = this.shopCode || '';
      this.resetOtp = '';
      this.resetNewPassword = '';
      this.resetConfirmPassword = '';
    }
  }

  onSendOtp(): void {
    if (!this.resetEmail) {
      this.snackBar.open('Please enter your email address.', 'Close', { duration: 3000 });
      return;
    }

    this.isSubmittingForgot = true;
    this.authService
      .forgotPassword({
        email: this.resetEmail,
        shopCode: this.resetShopCode || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmittingForgot = false;
          this.snackBar.open(
            res?.message || 'OTP sent successfully to your email.',
            'Close',
            { duration: 5000 }
          );
          this.authMode = 'FORGOT_STEP2';
          this.startResendTimer();
        },
        error: (err) => {
          this.isSubmittingForgot = false;
          this.snackBar.open(
            err?.error?.message || 'Failed to send OTP. Please check your email.',
            'Close',
            { duration: 4000 }
          );
        },
      });
  }

  onResetPassword(): void {
    if (!this.resetOtp || !this.resetNewPassword) {
      this.snackBar.open('Please enter OTP and new password.', 'Close', { duration: 3000 });
      return;
    }

    if (this.resetNewPassword.length < 6) {
      this.snackBar.open('Password must be at least 6 characters long.', 'Close', { duration: 3000 });
      return;
    }

    if (this.resetNewPassword !== this.resetConfirmPassword) {
      this.snackBar.open('Passwords do not match. Please check.', 'Close', { duration: 3000 });
      return;
    }

    this.isSubmittingReset = true;
    this.authService
      .resetPasswordWithOtp({
        email: this.resetEmail,
        otp: this.resetOtp,
        newPassword: this.resetNewPassword,
        shopCode: this.resetShopCode || undefined,
      })
      .subscribe({
        next: (res) => {
          this.isSubmittingReset = false;
          this.snackBar.open(
            res?.message || 'Password reset successfully! Please login with your new password.',
            'Close',
            { duration: 5000 }
          );
          this.email = this.resetEmail;
          this.shopCode = this.resetShopCode;
          this.password = '';
          this.authMode = 'LOGIN';
        },
        error: (err) => {
          this.isSubmittingReset = false;
          this.snackBar.open(
            err?.error?.message || 'Failed to reset password. Please check OTP.',
            'Close',
            { duration: 4000 }
          );
        },
      });
  }

  startResendTimer(): void {
    this.resendCountdown = 60;
    if (this.resendTimerInterval) {
      clearInterval(this.resendTimerInterval);
    }
    this.resendTimerInterval = setInterval(() => {
      if (this.resendCountdown > 0) {
        this.resendCountdown--;
      } else {
        clearInterval(this.resendTimerInterval);
      }
    }, 1000);
  }

  normalizeShopCode(value: string): void {
    this.shopCode = `${value || ''}`.toUpperCase().replace(/\s+/g, '');
  }

  normalizeResetShopCode(value: string): void {
    this.resetShopCode = `${value || ''}`.toUpperCase().replace(/\s+/g, '');
  }

  checkServerStatus(): void {
    this.serverReachable = null;
    this.serverStatusLabel = 'Checking server...';
    this.connectivityService.checkNow();
  }
}

