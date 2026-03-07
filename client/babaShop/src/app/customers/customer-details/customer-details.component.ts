import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomerService } from 'app/shared/services/customer.service';

@Component({
  selector: 'app-customer-details',
  templateUrl: './customer-details.component.html',
  styleUrls: ['./customer-details.component.css']
})
export class CustomerDetailsComponent implements OnInit {
  customer: any = null;
  sales: any[] = [];
  loading: boolean = true;
  salesLoading: boolean = true;
  
  // Pagination
  pageSize = 10;
  pageSizeOptions: number[] = [5, 10, 25, 50];
  totalSales: number = 0;
  currentPage: number = 1;

  // Account Statement - Date Filter
  startDate: string = '';
  endDate: string = '';
  statementSummary = {
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private customerService: CustomerService
  ) { }

  ngOnInit(): void {
    const customerId = this.route.snapshot.paramMap.get('id');
    if (customerId) {
      this.loadCustomer(customerId);
      this.loadCustomerSales(customerId, 1);
    }
  }

  loadCustomer(id: string): void {
    this.loading = true;
    this.customerService.getCustomerById(id).subscribe(
      (response: any) => {
        if (response.success) {
          this.customer = response.customer;
        }
        this.loading = false;
      },
      (error) => {
        console.error('Error loading customer:', error);
        this.loading = false;
      }
    );
  }

  loadCustomerSales(customerId: string, page: number): void {
    this.salesLoading = true;
    this.currentPage = page;
    this.customerService.getCustomerSales(customerId, {
      page: page,
      perPage: this.pageSize,
      dateFrom: this.startDate || null,
      dateTo: this.endDate || null,
    }).subscribe(
      (response: any) => {
        if (response.success) {
          this.sales = response.sales || [];
          this.totalSales = response.totalItems || 0;
          this.statementSummary = {
            totalDebit: response.summary?.totalDebit || 0,
            totalCredit: response.summary?.totalCredit || 0,
            closingBalance: response.summary?.closingBalance || 0,
          };
        }
        this.salesLoading = false;
      },
      (error) => {
        console.error('Error loading customer sales:', error);
        this.salesLoading = false;
      }
    );
  }

  applyDateFilter(): void {
    const customerId = this.route.snapshot.paramMap.get('id');
    if (!customerId) {
      return;
    }

    this.loadCustomerSales(customerId, 1);
  }

  clearFilters(): void {
    this.startDate = '';
    this.endDate = '';
    this.applyDateFilter();
  }

  getTransactionItems(entry: any): string {
    if (!Array.isArray(entry?.items) || entry.items.length === 0) {
      return entry?.note || '-';
    }

    return entry.items
      .map((item: any) => {
        const parts = [item?.itemName, item?.model].filter(Boolean);
        const base = parts.join(' ');
        return `${base || 'Item'} x${item?.quantity || 0}`;
      })
      .join(', ');
  }

  getTransactionBadgeClass(type: string): string {
    switch (type) {
      case 'payment':
        return 'badge-payment';
      case 'return':
        return 'badge-return';
      case 'refund':
        return 'badge-refund';
      default:
        return 'badge-purchase';
    }
  }

  getBalanceClass(balance: number): string {
    if (balance > 0) {
      return 'text-danger';
    }

    if (balance < 0) {
      return 'text-success';
    }

    return '';
  }

  onPageChange(event: any): void {
    const customerId = this.route.snapshot.paramMap.get('id');
    if (customerId) {
      this.pageSize = event.pageSize;
      this.loadCustomerSales(customerId, event.pageIndex + 1);
    }
  }

  goBack(): void {
    this.router.navigate(['/customer']);
  }

  viewTransaction(entry: any): void {
    if (entry?.saleId) {
      this.router.navigate(['/sale-list'], { queryParams: { saleId: entry.saleId } });
      return;
    }

    if (entry?.orderId) {
      this.router.navigate(['/order', entry.orderId]);
    }
  }

  getTotalDue(): number {
    return (this.customer?.totalDue || 0);
  }
}
