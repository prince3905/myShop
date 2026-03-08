import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatDialog } from "@angular/material/dialog";
import { OrderService } from "app/shared/services/order.service";
import { AuthService } from "app/shared/services/auth.service";
import { OrderPaymentDialogComponent } from "./order-payment-dialog.component";

@Component({
  selector: "app-order-details",
  templateUrl: "./order-details.component.html",
  styleUrls: ["./order-details.component.css"],
})
export class OrderDetailsComponent implements OnInit {
  loading = true;
  order: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    const id = `${this.route.snapshot.paramMap.get("id") || ""}`.trim();
    if (!id) {
      this.router.navigate(["/order"]);
      return;
    }

    this.orderService.getOrderById(id).subscribe({
      next: (res: any) => {
        this.order = res?.order || null;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.snackBar.open(err?.error?.message || "Unable to load order", "Close", {
          duration: 2800,
        });
        this.router.navigate(["/order"]);
      },
    });
  }

  getLineTotal(item: any): number {
    return Number(item?.totalPrice || 0);
  }

  getAdvanceAmount(): number {
    return Number(this.order?.paidAmount || 0);
  }

  getBalanceAmount(): number {
    return Number(this.order?.dueAmount || 0);
  }

  getPaymentHistory(): any[] {
    const history = Array.isArray(this.order?.paymentHistory) ? [...this.order.paymentHistory] : [];
    return history.sort((a: any, b: any) => {
      const aTime = new Date(a?.collectedAt || 0).getTime();
      const bTime = new Date(b?.collectedAt || 0).getTime();
      return bTime - aTime;
    });
  }

  getPaymentHistoryCount(): number {
    return this.getPaymentHistory().length;
  }

  getOrderStateLabel(): string {
    const status = `${this.order?.orderStatus || "PENDING"}`.toUpperCase();
    const payment = `${this.order?.paymentStatus || "PENDING"}`.toUpperCase();
    if (status === "DELIVERED" && payment === "PAID") return "Delivered and fully paid";
    if (status === "DELIVERED") return "Delivered, payment pending";
    if (status === "SHIPPED") return "Shipped to customer";
    if (status === "CONFIRMED") return "Confirmed, delivery pending";
    if (status === "CANCELLED") return "Cancelled";
    if (status === "RETURNED") return "Returned";
    return "Pending confirmation";
  }

  canEditOrder(): boolean {
    return !this.authService.isGlobalReadOnlyMode() && `${this.order?.orderStatus || ""}`.toUpperCase() === "PENDING";
  }

  getEditOrderHint(): string {
    if (this.authService.isGlobalReadOnlyMode()) {
      return "Select a shop first to edit orders";
    }
    if (`${this.order?.orderStatus || ""}`.toUpperCase() !== "PENDING") {
      return "Only pending orders can be edited";
    }
    return "Edit this order";
  }

  editOrder(): void {
    const id = `${this.order?._id || ""}`.trim();
    if (!id || !this.canEditOrder()) return;
    this.router.navigate(["/order/edit", id]);
  }

  collectPayment(): void {
    if (!this.order?._id) return;
    if (this.authService.isGlobalReadOnlyMode()) {
      this.snackBar.open("Select a shop first to collect payment", "Close", { duration: 2600 });
      return;
    }

    const ref = this.dialog.open(OrderPaymentDialogComponent, {
      width: "460px",
      maxWidth: "96vw",
      data: { order: this.order },
    });

    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.order = result;
      }
    });
  }
}
