import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, NavigationExtras, Router } from '@angular/router';
import { OrderService } from 'app/shared/services/order.service';
import { AuthService } from 'app/shared/services/auth.service';

@Component({
  selector: 'orders',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnInit {
  loading = true;
  orders: any[] = [];
  overview: any = {
    totalOrders: 0,
    offlineOrders: 0,
    onlineOrders: 0,
    totalQuantity: 0,
    totalAmount: 0,
    totalCollected: 0,
    totalDue: 0,
    deliveryPendingCount: 0,
    todayOrders: 0,
    todayCollection: 0,
    overdueDeliveryCount: 0,
    totalCostAmount: 0,
    totalProfit: 0,
  };
  search = '';
  orderStatus = 'ALL';
  paymentStatus = 'ALL';
  dateFrom = '';
  dateTo = '';
  updatingOrderId: string | null = null;

  pageSize = 10;
  pageSizeOptions: number[] = [5, 10, 25, 50];
  totalItems = 0;
  currentPageIndex = 0;

  readonly orderStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];
  readonly paymentStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED'];

  constructor(
    private orderService: OrderService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const page = Math.max(1, Number(params.page || 1));
      const perPage = Math.max(1, Number(params.perPage || this.pageSize));
      this.search = params.search || '';
      this.orderStatus = params.orderStatus || 'ALL';
      this.paymentStatus = params.paymentStatus || 'ALL';
      this.dateFrom = params.dateFrom || '';
      this.dateTo = params.dateTo || '';
      this.pageSize = perPage;
      this.currentPageIndex = page - 1;

      this.getAllOrders({
        page,
        perPage,
        ...(this.search.trim() ? { search: this.search.trim() } : {}),
        ...(this.orderStatus !== 'ALL' ? { orderStatus: this.orderStatus } : {}),
        ...(this.paymentStatus !== 'ALL' ? { paymentStatus: this.paymentStatus } : {}),
        ...(this.dateFrom ? { dateFrom: this.dateFrom } : {}),
        ...(this.dateTo ? { dateTo: this.dateTo } : {}),
      });
    });
  }

  getAllOrders(queryParamsObj: any): void {
    this.loading = true;
    this.orderService.listOrders(queryParamsObj).subscribe({
      next: (response: any) => {
        this.orders = response.orders || [];
        this.totalItems = response.totalItems || 0;
        this.overview = response.overview || this.overview;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error retrieving orders:', error);
        this.orders = [];
        this.totalItems = 0;
        this.overview = {
          totalOrders: 0,
          offlineOrders: 0,
          onlineOrders: 0,
          totalQuantity: 0,
          totalAmount: 0,
          totalCollected: 0,
          totalDue: 0,
          deliveryPendingCount: 0,
          todayOrders: 0,
          todayCollection: 0,
          overdueDeliveryCount: 0,
          totalCostAmount: 0,
          totalProfit: 0,
        };
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.navigateWithParams(1);
  }

  onClear(): void {
    this.search = '';
    this.orderStatus = 'ALL';
    this.paymentStatus = 'ALL';
    this.dateFrom = '';
    this.dateTo = '';
    this.navigateWithParams(1);
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.navigateWithParams(event.pageIndex + 1);
  }

  updateOrderStatus(order: any, field: 'orderStatus' | 'paymentStatus', value: string): void {
    if (!order?._id || !value) {
      return;
    }
    if (this.authService.isGlobalReadOnlyMode()) {
      this.snackBar.open('Select a shop first to update order status', 'Close', { duration: 2600 });
      this.navigateWithParams(this.currentPageIndex + 1);
      return;
    }

    this.updatingOrderId = order._id;
    this.orderService.updateOrderStatus(order._id, { [field]: value }).subscribe({
      next: (response: any) => {
        if (response?.order) {
          order.orderStatus = response.order.orderStatus;
          order.paymentStatus = response.order.paymentStatus;
          order.paymentMethod = response.order.paymentMethod;
        }
        this.snackBar.open(response?.message || 'Order updated successfully', 'Close', {
          duration: 2500,
        });
        this.updatingOrderId = null;
      },
      error: (error) => {
        console.error('Error updating order:', error);
        this.snackBar.open(error?.error?.message || 'Unable to update order', 'Close', {
          duration: 3000,
        });
        this.updatingOrderId = null;
        this.navigateWithParams(this.currentPageIndex + 1);
      }
    });
  }

  getItemSummary(order: any): string {
    const items = Array.isArray(order?.items) ? order.items : [];
    if (!items.length) {
      return '-';
    }

    return items
      .slice(0, 2)
      .map((item: any) => {
        const title = [item?.productName, item?.modelName].filter(Boolean).join(' ');
        return `${title || item?.sku || 'Item'} x${item?.quantity || 0}`;
      })
      .join(', ');
  }

  getRemainingItems(order: any): number {
    const items = Array.isArray(order?.items) ? order.items : [];
    return Math.max(0, items.length - 2);
  }

  canViewSensitivePricing(): boolean {
    return this.authService.canViewSensitivePricing();
  }

  openOrder(order: any): void {
    const id = `${order?._id || ""}`.trim();
    if (!id) return;
    this.router.navigate(["/order", id]);
  }

  canEditOrder(order: any): boolean {
    return this.authService.can("sales.orders.manage")
      && !this.authService.isGlobalReadOnlyMode()
      && `${order?.orderStatus || ""}`.toUpperCase() === 'PENDING';
  }

  canManageOrders(): boolean {
    return this.authService.can("sales.orders.manage") && !this.authService.isGlobalReadOnlyMode();
  }

  getEditOrderHint(order: any): string {
    if (this.authService.isGlobalReadOnlyMode()) {
      return 'Select a shop first to edit orders';
    }
    if (`${order?.orderStatus || ""}`.toUpperCase() !== 'PENDING') {
      return 'Only pending orders can be edited';
    }
    return 'Edit this order';
  }

  editOrder(order: any): void {
    const id = `${order?._id || ""}`.trim();
    if (!id || !this.canEditOrder(order)) return;
    this.router.navigate(["/order/edit", id]);
  }

  private navigateWithParams(page: number): void {
    const queryParams = {
      page,
      perPage: this.pageSize,
      ...(this.search.trim() ? { search: this.search.trim() } : {}),
      ...(this.orderStatus !== 'ALL' ? { orderStatus: this.orderStatus } : {}),
      ...(this.paymentStatus !== 'ALL' ? { paymentStatus: this.paymentStatus } : {}),
      ...(this.dateFrom ? { dateFrom: this.dateFrom } : {}),
      ...(this.dateTo ? { dateTo: this.dateTo } : {}),
    };

    const navigationExtras: NavigationExtras = {
      relativeTo: this.route,
      queryParams,
    };

    this.router.navigate([], navigationExtras);
  }
}
