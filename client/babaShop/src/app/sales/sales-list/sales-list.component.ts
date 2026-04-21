import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { PageEvent } from "@angular/material/paginator";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { SalesService } from "app/shared/services/sales.service";
import { SalePaymentDialogComponent } from "../sale-payment-dialog/sale-payment-dialog.component";
import { AuthService } from "app/shared/services/auth.service";
import { ShopService } from "app/shared/services/shop.service";

@Component({
  selector: "sales-list",
  templateUrl: "./sales-list.component.html",
  styleUrls: ["./sales-list.component.css"],
})
export class SalesListComponent implements OnInit {
  loading = false;

  salesRows: any[] = [];
  totalItems = 0;
  page = 1;
  pageSize = 10;
  pageSizeOptions: number[] = [5, 10, 25, 50, 100];

  selectedSale: any = null;
  @ViewChild("saleDetailsCard") saleDetailsCard?: ElementRef<HTMLElement>;
  
  // Shop Details for Payment
  shopUpiId: string = "";
  shopPhone: string = "";

  filters: {
    invoiceNo: string;
    customerName: string;
    itemName: string;
    startDate: Date | null;
    endDate: Date | null;
    returnStatus: string;
    paymentMethod: string;
    dueOnly: boolean;
  } = {
    invoiceNo: "",
    customerName: "",
    itemName: "",
    startDate: null,
    endDate: null,
    returnStatus: "",
    paymentMethod: "",
    dueOnly: false,
  };

  summary = {
    totalSales: 0,
    totalRevenue: 0,
    totalQty: 0,
  };

  todaySummary: any = {
    transactionCount: 0,
    grossSales: 0,
    netSales: 0,
    cash: 0,
    card: 0,
    digital: 0,
    due: 0,
    returns: 0,
  };

  constructor(
    public dialog: MatDialog,
    private salesService: SalesService,
    private snackBar: MatSnackBar,
    private router: Router,
    public authService: AuthService,
    private shopService: ShopService, // Injected ShopService
    private cdr: ChangeDetectorRef, // Added back
  ) {}

  ngOnInit(): void {
    this.loadSales();
    this.loadShopDetails();
    this.loadTodaySummary();
  }

  loadTodaySummary(): void {
    this.salesService.getZReport().subscribe({
      next: (res: any) => {
        if (res?.success) {
          const data = res.data || {};
          const salesSummary = data.salesSummary || {};
          const payment = data.paymentBreakdown || {};
          this.todaySummary = {
            transactionCount: data.transactionCount || 0,
            grossSales: salesSummary.grossSales || 0,
            netSales: salesSummary.netSales || 0,
            cash: payment.cash || 0,
            card: payment.card || 0,
            digital: payment.digital || 0,
            due: salesSummary.totalDue || 0,
            returns: salesSummary.totalReturns || 0,
          };
        }
      },
      error: () => {
        console.error("Failed to load today's summary");
      }
    });
  }

  loadShopDetails(): void {
    const shopId = this.authService.getShopId();
    if (shopId) {
      this.shopService.getShopById(shopId).subscribe({
        next: (res: any) => {
          const shop = res?.data;
          if (shop) {
            this.shopUpiId = shop.paymentSettings?.upiId || "N/A";
            this.shopPhone = shop.contactNumber || shop.owner?.phoneNo || "N/A";
          }
        },
        error: (err) => {
          console.error("Failed to load shop details for bill", err);
        }
      });
    }
  }

  get canCreateSale(): boolean {
    return this.authService.can("sales.pos") && !this.authService.isGlobalReadOnlyMode();
  }

  loadSales(): void {
    this.loading = true;

    const params: any = {
      page: this.page,
      perPage: this.pageSize,
      invoiceNo: this.filters.invoiceNo?.trim() || undefined,
      customerName: this.filters.customerName?.trim() || undefined,
      itemName: this.filters.itemName?.trim() || undefined,
      startDate: this.filters.startDate ? this.formatDateForApi(this.filters.startDate) : undefined,
      endDate: this.filters.endDate ? this.formatDateForApi(this.filters.endDate) : undefined,
      returnStatus: this.filters.returnStatus || undefined,
      paymentMethod: this.filters.paymentMethod || undefined,
      dueOnly: this.filters.dueOnly ? "true" : undefined,
    };

    this.salesService.getSales(params).subscribe({
      next: (response: any) => {
        this.salesRows = Array.isArray(response?.itemResults) ? response.itemResults : [];
        this.totalItems = Number(response?.totalItems || 0);
        this.summary.totalSales = this.totalItems;
        this.summary.totalRevenue = this.salesRows.reduce(
          (acc, row) => acc + Number(row?.totalPurchasePrice || 0),
          0,
        );
        this.summary.totalQty = this.salesRows.reduce(
          (acc, row) => acc + Number(row?.totalQuantity || 0),
          0,
        );
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.salesRows = [];
        this.totalItems = 0;
        this.summary = { totalSales: 0, totalRevenue: 0, totalQty: 0 };
        this.snackBar.open(err?.error?.message || "Failed to load sales", "Close", {
          duration: 2800,
        });
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.loadSales();
  }

  clearFilters(): void {
    this.filters = {
      customerName: "",
      invoiceNo: "",
      itemName: "",
      startDate: null,
      endDate: null,
      returnStatus: "",
      paymentMethod: "",
      dueOnly: false,
    };
    this.page = 1;
    this.loadSales();
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadSales();
  }

  openAddSaleModal(): void {
    if (!this.canCreateSale) {
      return;
    }
    this.router.navigate(["/pos"]);
  }

  exportCsv(): void {
    const params: any = {
      page: 1,
      perPage: 5000,
      invoiceNo: this.filters.invoiceNo?.trim() || undefined,
      customerName: this.filters.customerName?.trim() || undefined,
      itemName: this.filters.itemName?.trim() || undefined,
      startDate: this.filters.startDate ? this.formatDateForApi(this.filters.startDate) : undefined,
      endDate: this.filters.endDate ? this.formatDateForApi(this.filters.endDate) : undefined,
      returnStatus: this.filters.returnStatus || undefined,
      paymentMethod: this.filters.paymentMethod || undefined,
      dueOnly: this.filters.dueOnly ? "true" : undefined,
    };

    this.salesService.getSales(params).subscribe({
      next: (response: any) => {
        const rows = Array.isArray(response?.itemResults) ? response.itemResults : [];
        if (!rows.length) {
          this.snackBar.open("No data found for CSV export", "Close", { duration: 2400 });
          return;
        }

        const headers = [
          "Invoice",
          "Customer",
          "Date",
          "Payment Method",
          "Status",
          "Total",
          "Paid",
          "Due",
          "Outstanding",
          "Returned Qty",
          "Total Qty",
          "Returned Amount",
          "Refunded Amount",
        ];

        const escapeCsv = (value: any): string => {
          const text = `${value ?? ""}`.replace(/"/g, '""');
          return `"${text}"`;
        };

        const lines = [
          headers.join(","),
          ...rows.map((row: any) =>
            [
              row?.invoiceNo || row?._id || "",
              row?.customerName || "Walk-in",
              row?.purchaseDate ? new Date(row.purchaseDate).toLocaleString() : "",
              row?.paymentMethod || "",
              row?.status || "",
              Number(row?.totalPurchasePrice || 0).toFixed(2),
              Number(row?.paidAmount || 0).toFixed(2),
              Number(row?.dueAmount || 0).toFixed(2),
              Number(row?.dueAmount || 0).toFixed(2),
              Number(row?.returnedQuantity || 0),
              Number(row?.totalQuantity || 0),
              Number(row?.returnedAmount || 0).toFixed(2),
              Number(row?.refundedAmount || 0).toFixed(2),
            ]
              .map(escapeCsv)
              .join(","),
          ),
        ];

        const csv = lines.join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        a.href = url;
        a.download = `sales-export-${stamp}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        this.snackBar.open("Sales CSV exported", "Close", { duration: 2200 });
      },
      error: (err) => {
        this.snackBar.open(err?.error?.message || "Failed to export CSV", "Close", { duration: 2800 });
      },
    });
  }

  showDetails(row: any): void {
    this.selectedSale = row;
    setTimeout(() => {
      this.saleDetailsCard?.nativeElement?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  closeDetails(): void {
    this.selectedSale = null;
  }

  openReturn(row: any): void {
    const saleId = `${row?._id || ""}`.trim();
    if (!saleId) return;
    this.router.navigate(["/returns"], { queryParams: { saleId } });
  }

  openCollectPayment(row: any): void {
    if (Number(row?.dueAmount || 0) <= 0) {
      this.snackBar.open("No due for this invoice", "Close", { duration: 2200 });
      return;
    }

    const ref = this.dialog.open(SalePaymentDialogComponent, {
      width: "520px",
      maxWidth: "96vw",
      disableClose: false,
      data: { sale: row },
    });
    ref.afterClosed().subscribe((ok) => {
      if (ok) {
        this.loadSales();
        if (this.selectedSale?._id === row?._id) {
          this.selectedSale = null;
        }
      }
    });
  }

  getReturnBadge(row: any): "none" | "partial" | "full" {
    const totalQty = Number(row?.totalQuantity || 0);
    const returnedQty = Number(row?.returnedQuantity || 0);
    if (returnedQty <= 0) return "none";
    if (totalQty > 0 && returnedQty >= totalQty) return "full";
    return "partial";
  }

  isReturnClosed(row: any): boolean {
    return this.getReturnBadge(row) === "full";
  }

  hasDue(): boolean {
    return this.salesRows.some(row => (row?.dueAmount || 0) > 0);
  }

  getDueCount(): number {
    return this.salesRows.filter(row => (row?.dueAmount || 0) > 0).length;
  }

  shareOnWhatsApp(row: any): void {
    // Agar details load nahi hui hain toh pehle load karein
    if (!this.shopUpiId || this.shopUpiId === "N/A") {
      this.loadShopDetails();
      // User ko thoda wait karwayein taaki data aa jaye
      setTimeout(() => {
        this.generateWhatsAppMessage(row);
      }, 1000);
    } else {
      this.generateWhatsAppMessage(row);
    }
  }

  generateWhatsAppMessage(row: any): void {
    const invoiceId = row?.invoiceNo || row?._id || "-";
    const customerName = row?.customerName || "Walk-in";
    const dateStr = row?.purchaseDate ? new Date(row.purchaseDate).toLocaleString() : "-";
    const grandTotal = Number(row?.totalAmount ?? 0);
    const paidAmount = Number(row?.paidAmount || 0);
    const dueAmount = Number(row?.dueAmount ?? Math.max(grandTotal - paidAmount, 0));

    // Professional Header
    let message = `🏢 *BABA VISHWANATH TRUNK & FURNITURE HOUSE*\n\n`;

    message += `🧾 *INVOICE: ${invoiceId}*\n`;
    message += `Customer: ${customerName}\n`;
    message += `Date: ${dateStr}\n\n`;

    // Add Items List
    if (row.items && row.items.length > 0) {
      message += `📦 *ITEMS:*\n`;
      row.items.forEach((item: any, index: number) => {
        message += `${index + 1}. ${item.itemName || 'Item'}\n`;
        if (item.model || item.size || item.color) {
          const details = [item.model, item.size, item.color].filter(Boolean).join(', ');
          if (details) message += `   (${details})\n`;
        }
        message += `   Qty: ${item.quantity} | Rate: ${item.sellingPrice}\n`;
        message += `   Total: Rs ${item.total}\n\n`;
      });
      message += `----------------------------\n`;
    }

    // Totals
    message += `💰 *Grand Total:* Rs ${grandTotal.toFixed(2)}\n`;
    message += `✅ *Paid:* Rs ${paidAmount.toFixed(2)}\n`;

    // Due Alert
    if (dueAmount > 0.5) {
      message += `⚠️ *DUE AMOUNT: Rs ${dueAmount.toFixed(2)}*\n\n`;
      message += `📲 *Action:* Please clear the pending dues.\n`;
    } else {
      message += `----------------------------\n`;
      message += `✨ *Status: Fully Paid* ✨\n`;
    }

    // Payment Details (Dynamic from Settings)
    message += `\n📲 *PAYMENT DETAILS*\n`;
    message += `UPI ID: ${this.shopUpiId || "Not Set in Settings"}\n`;
    message += `Phone: ${this.shopPhone || "Not Set in Settings"}\n`;
    message += `\n_Please pay to the details above only._`;

    message += `\n\n_Thank you for shopping with us!_`;

    // Check for phone number
    let phone = "";
    if (row?.customerPhone) {
      phone = String(row.customerPhone).replace(/\D/g, '');
    }

    let url = "";
    if (phone.length >= 10) {
      const prefix = phone.length === 10 ? "91" : "";
      url = `https://wa.me/${prefix}${phone}?text=${encodeURIComponent(message)}`;
    } else {
      url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    }

    window.open(url, '_blank');
  }

  downloadPDF(row: any): void {
    // Trigger print dialog which allows "Save as PDF"
    this.printInvoice(row);
  }

  printInvoice(row: any): void {
    const invoiceId = row?.invoiceNo || row?._id || "-";
    const customerName = row?.customerName || "Walk-in";
    const dateStr = row?.purchaseDate ? new Date(row.purchaseDate).toLocaleString() : "-";
    const subTotal = Number(row?.totalPurchasePrice || 0);
    const discount = Number(row?.billDiscount || 0);
    const grandTotal = Number(row?.totalAmount ?? Math.max(subTotal - discount, 0));
    const paidAmount = Number(row?.paidAmount || 0);
    const dueAmount = Number(row?.dueAmount ?? Math.max(grandTotal - paidAmount, 0));
    const paymentMethod = row?.paymentMethod || "-";
    const taxRates = (row?.items || [])
      .map((it: any) => Number(it?.taxPercent || 0))
      .filter((r: number) => Number.isFinite(r) && r > 0);
    const gstRate = taxRates.length ? Math.max(...taxRates) : 0;
    const isInterState = !!row?.isInterState;
    let taxableAmount = grandTotal;
    let gstAmount = 0;
    if (gstRate > 0) {
      taxableAmount = Number((grandTotal * (100 / (100 + gstRate))).toFixed(2));
      gstAmount = Number((grandTotal - taxableAmount).toFixed(2));
    }
    const cgstAmount = isInterState ? 0 : Number((gstAmount / 2).toFixed(2));
    const sgstAmount = isInterState ? 0 : Number((gstAmount / 2).toFixed(2));
    const igstAmount = isInterState ? gstAmount : 0;
    const itemRows = (row?.items || [])
      .map(
        (it: any, idx: number) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${it?.itemName || "-"}</td>
            <td>${it?.model || "-"}</td>
            <td>${it?.size || "-"}</td>
            <td>${Number(it?.quantity || 0)}</td>
            <td>${Number(it?.sellingPrice || 0).toFixed(2)}</td>
            <td>${(Number(it?.quantity || 0) * Number(it?.sellingPrice || 0)).toFixed(2)}</td>
          </tr>
        `,
      )
      .join("");

    const html = `
      <html>
      <head>
        <title>Invoice ${invoiceId}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 18px; }
          h2 { margin: 0 0 6px; }
          .meta { margin-bottom: 10px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
          th { background: #f8fafc; }
          .tot { margin-top: 10px; font-weight: 700; }
          .tax-note { margin-top: 8px; font-size: 11px; color: #475569; }
        </style>
      </head>
      <body>
        <h2>Sales Invoice</h2>
        <div class="meta">Invoice: ${invoiceId}</div>
        <div class="meta">Customer: ${customerName}</div>
        <div class="meta">Date: ${dateStr}</div>
        <div class="meta">Payment Mode: ${paymentMethod}</div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Model</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div class="tot">Total Qty: ${Number(row?.totalQuantity || 0)}</div>
        <div class="tot">Sub Total: Rs ${subTotal.toFixed(2)}</div>
        <div class="tot">Discount: Rs ${discount.toFixed(2)}</div>
        <div class="tot">Taxable Amount: Rs ${taxableAmount.toFixed(2)}</div>
        <div class="tot">CGST ${isInterState ? "0.00" : (gstRate / 2).toFixed(2)}%: Rs ${cgstAmount.toFixed(2)}</div>
        <div class="tot">SGST ${isInterState ? "0.00" : (gstRate / 2).toFixed(2)}%: Rs ${sgstAmount.toFixed(2)}</div>
        <div class="tot">IGST ${isInterState ? gstRate.toFixed(2) : "0.00"}%: Rs ${igstAmount.toFixed(2)}</div>
        <div class="tot">Grand Total: Rs ${grandTotal.toFixed(2)}</div>
        <div class="tot">Paid: Rs ${paidAmount.toFixed(2)}</div>
        <div class="tot">Due: Rs ${dueAmount.toFixed(2)}</div>
        <div class="tax-note">
          GST breakup is auto-calculated from available item tax rate. If tax rate is not captured in sale items, breakup shows 0.00.
        </div>
      </body>
      </html>
    `;

    const printWin = window.open("", "_blank", "width=900,height=700");
    if (!printWin) {
      this.snackBar.open("Popup blocked. Please allow popups for printing.", "Close", {
        duration: 3000,
      });
      return;
    }

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    printWin.print();
  }

  private formatDateForApi(d: Date): string {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = `${dt.getMonth() + 1}`.padStart(2, "0");
    const dd = `${dt.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}
