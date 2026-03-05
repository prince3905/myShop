import { Component, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { PageEvent } from "@angular/material/paginator";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AddSalesComponent } from "../add-sales/add-sales.component";
import { SalesService } from "app/shared/services/sales.service";

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

  filters: {
    customerName: string;
    itemName: string;
    startDate: Date | null;
    endDate: Date | null;
  } = {
    customerName: "",
    itemName: "",
    startDate: null,
    endDate: null,
  };

  summary = {
    totalSales: 0,
    totalRevenue: 0,
    totalQty: 0,
  };

  constructor(
    public dialog: MatDialog,
    private salesService: SalesService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.loadSales();
  }

  loadSales(): void {
    this.loading = true;

    const params: any = {
      page: this.page,
      perPage: this.pageSize,
      customerName: this.filters.customerName?.trim() || undefined,
      itemName: this.filters.itemName?.trim() || undefined,
      startDate: this.filters.startDate ? this.formatDateForApi(this.filters.startDate) : undefined,
      endDate: this.filters.endDate ? this.formatDateForApi(this.filters.endDate) : undefined,
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
      itemName: "",
      startDate: null,
      endDate: null,
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
    const dialogRef = this.dialog.open(AddSalesComponent, {
      width: "1080px",
      maxWidth: "96vw",
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.page = 1;
        this.loadSales();
      }
    });
  }

  showDetails(row: any): void {
    this.selectedSale = row;
  }

  closeDetails(): void {
    this.selectedSale = null;
  }

  printInvoice(row: any): void {
    const invoiceId = row?._id || "-";
    const customerName = row?.customerName || "Walk-in";
    const dateStr = row?.purchaseDate ? new Date(row.purchaseDate).toLocaleString() : "-";
    const subTotal = Number(row?.totalPurchasePrice || 0);
    const discount = Number(row?.billDiscount || 0);
    const grandTotal = Number(row?.totalAmount ?? Math.max(subTotal - discount, 0));
    const paidAmount = Number(row?.paidAmount || 0);
    const dueAmount = Number(row?.dueAmount ?? Math.max(grandTotal - paidAmount, 0));
    const paymentMethod = row?.paymentMethod || "-";
    const itemRows = (row?.items || [])
      .map(
        (it: any, idx: number) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${it?.itemName || "-"}</td>
            <td>${it?.model || "-"}</td>
            <td>${it?.size || "-"}</td>
            <td>${Number(it?.quantity || 0)}</td>
            <td>${Number(it?.purchasePrice || 0).toFixed(2)}</td>
            <td>${(Number(it?.quantity || 0) * Number(it?.purchasePrice || 0)).toFixed(2)}</td>
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
        <div class="tot">Grand Total: Rs ${grandTotal.toFixed(2)}</div>
        <div class="tot">Paid: Rs ${paidAmount.toFixed(2)}</div>
        <div class="tot">Due: Rs ${dueAmount.toFixed(2)}</div>
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
