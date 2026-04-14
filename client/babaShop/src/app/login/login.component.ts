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

  checkServerStatus(): void {
    this.serverReachable = null;
    this.serverStatusLabel = 'Checking server...';
    this.connectivityService.checkNow();
  }
}
