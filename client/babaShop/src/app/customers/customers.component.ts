import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, NavigationExtras, Router } from '@angular/router';
import { AddCustomerDialogComponent } from 'app/sales/add-customer-dialog/add-customer-dialog.component';
import { CustomerService } from 'app/shared/services/customer.service';
import { AuthService } from 'app/shared/services/auth.service';

@Component({
  selector: 'customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css']
})
export class CustomersComponent implements OnInit {
  name: string = '';
  loading: boolean = true;
  customers: any[] = [];
  paginatedItems: any[] = [];
  pageSize = 10;
  pageSizeOptions: number[] = [5, 10, 25, 50];
  totalItems: number = 0;
  currentPageIndex: number = 0;

  constructor(
    public dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private customerService: CustomerService,
    public authService: AuthService,
  ) { }

  get canManageCustomers(): boolean {
    return !this.authService.isGlobalReadOnlyMode() && this.authService.can("people.customers.manage");
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const page = Math.max(1, Number(params.page || 1));
      const perPage = Math.max(1, Number(params.perPage || this.pageSize));
      this.name = params.name || '';
      this.pageSize = perPage;
      this.currentPageIndex = page - 1;
      this.getAllCustomer({
        page,
        perPage,
        ...(this.name.trim() ? { name: this.name.trim() } : {}),
      });
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.navigateWithParams(event.pageIndex + 1);
  }

  onSearch(): void {
    this.navigateWithParams(1);
  }

  onClear(): void {
    this.name = '';
    this.navigateWithParams(1);
  }

  openAddCustomerDialog(): void {
    if (!this.canManageCustomers) {
      return;
    }
    const dialogRef = this.dialog.open(AddCustomerDialogComponent, {
      width: '420px',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((customer) => {
      if (!customer) {
        return;
      }

      this.name = customer.name || '';
      this.navigateWithParams(1);
    });
  }

  openEditCustomerDialog(customer: any): void {
    if (!this.canManageCustomers || !customer?._id) {
      return;
    }

    const dialogRef = this.dialog.open(AddCustomerDialogComponent, {
      width: '420px',
      disableClose: true,
      data: { customer },
    });

    dialogRef.afterClosed().subscribe((updatedCustomer) => {
      if (!updatedCustomer) {
        return;
      }

      this.getAllCustomer({
        page: this.currentPageIndex + 1,
        perPage: this.pageSize,
        ...(this.name.trim() ? { name: this.name.trim() } : {}),
      });
    });
  }

  getAllCustomer(queryParamsObj: any): void {
    this.loading = true;
    this.customerService.getCustomer(queryParamsObj).subscribe(
      (response: any) => {
        this.customers = response.customers || [];
        this.paginatedItems = [...this.customers];
        this.totalItems = response.totalItems || 0;
        this.loading = false;
      },
      (error) => {
        this.loading = false;
        console.error('Error retrieving customers:', error);
      }
    );
  }

  viewItemDetails(itemId: string): void {
    this.router.navigate(['/customer', itemId]);
  }

  private navigateWithParams(page: number): void {
    const queryParams = {
      page,
      perPage: this.pageSize,
      ...(this.name.trim() ? { name: this.name.trim() } : {}),
    };
    const navigationExtras: NavigationExtras = {
      relativeTo: this.route,
      queryParams,
    };

    this.router.navigate([], navigationExtras);
  }
}
