import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { FraudDetectionService } from 'app/shared/services/fraud-detection.service';
import { AuthService } from 'app/shared/services/auth.service';
import { ShopService } from 'app/shared/services/shop.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'fraud-detection',
  templateUrl: './fraud-detection.component.html',
  styleUrls: ['./fraud-detection.component.css'],
  standalone: false,
})
export class FraudDetectionComponent implements OnInit {
  loading: boolean = false;
  days: number = 7;
  report: any = null;
  shops: any[] = [];
  selectedShopId: string = '';
  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedSeverity: string = 'ALL';
  filteredAlertsMap: Map<string, any[]> = new Map();
  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;

  constructor(
    private fraudDetectionService: FraudDetectionService,
    public authService: AuthService,
    private shopService: ShopService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    if (this.authService.isSuperAdmin()) {
      this.loadShops();
    }
    this.loadReport();
  }

  loadShops(): void {
    this.shopService.getAllShops().subscribe(
      (response: any) => {
        console.log('Shops API Response:', response);
        this.shops = response.data || response.shops || [];
        console.log('Shops loaded:', this.shops);
      },
      (error) => {
        console.error('Error loading shops:', error);
      }
    );
  }

  loadReport(): void {
    this.loading = true;
    const isSuperAdmin = this.authService.isSuperAdmin();
    const shopId = isSuperAdmin && this.selectedShopId ? this.selectedShopId : undefined;

    const request = this.startDate && this.endDate 
      ? this.fraudDetectionService.getFraudDetectionReport(null, shopId, this.startDate, this.endDate)
      : this.fraudDetectionService.getFraudDetectionReport(this.days, shopId);

    request.subscribe(
      (response: any) => {
        if (response && response.success) {
          this.report = response.data;
        } else {
          this.snackBar.open('Invalid response from server', 'OK', { duration: 3000 });
        }
        this.loading = false;
      },
      (error) => {
        this.loading = false;
        const errMsg = error?.error?.message || error?.message || 'रिपोर्ट लोड करने में त्रुटि हुई';
        this.snackBar.open(errMsg, 'OK', { duration: 5000 });
        console.error('Fraud detection error:', error);
      }
    );
  }

  onDaysChange(): void {
    // Clear custom dates when quick select is used
    this.startDate = null;
    this.endDate = null;
    this.loadReport();
  }

  onDateChange(): void {
    // Reset days when custom dates are selected
    if (this.startDate && this.endDate) {
      this.days = null;
      this.loadReport();
    }
  }

  clearDates(): void {
    this.startDate = null;
    this.endDate = null;
    this.days = 7;
    this.loadReport();
  }

  filterAlerts(): void {
    if (!this.report?.shops) return;
    
    this.filteredAlertsMap.clear();
    this.report.shops.forEach((shopReport: any) => {
      const shopKey = shopReport.shop?.id || 'unknown';
      if (this.selectedSeverity === 'ALL') {
        this.filteredAlertsMap.set(shopKey, shopReport.alerts || []);
      } else {
        const filtered = (shopReport.alerts || []).filter(
          (a: any) => a.severity === this.selectedSeverity
        );
        this.filteredAlertsMap.set(shopKey, filtered);
      }
    });
  }

  getFilteredAlerts(alerts: any[]): any[] {
    if (!alerts) return [];
    if (this.selectedSeverity === 'ALL') return alerts;
    return alerts.filter(a => a.severity === this.selectedSeverity);
  }

  onShopChange(): void {
    this.loadReport();
  }

  getSeverityColor(severity: string): string {
    switch (severity) {
      case 'HIGH': return 'warn';
      case 'MEDIUM': return 'accent';
      case 'LOW': return 'primary';
      default: return 'primary';
    }
  }

  getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'info';
      default: return 'info';
    }
  }
}
