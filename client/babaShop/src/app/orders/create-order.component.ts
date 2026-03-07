import { Component, OnDestroy, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ActivatedRoute, Router } from "@angular/router";
import { CustomerService } from "app/shared/services/customer.service";
import { ItemService } from "app/shared/services/item.service";
import { OrderService } from "app/shared/services/order.service";
import { Subject, of } from "rxjs";
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from "rxjs/operators";

@Component({
  selector: "app-create-order",
  templateUrl: "./create-order.component.html",
  styleUrls: ["./create-order.component.css"],
})
export class CreateOrderComponent implements OnInit, OnDestroy {
  readonly sourceOptions = [
    { label: "Offline", value: "POS" },
    { label: "Online", value: "ONLINE" },
  ];
  readonly paymentMethods = ["CASH", "UPI", "CARD", "BANK_TRANSFER"];
  readonly paymentStatuses = ["PENDING", "PAID", "FAILED"];

  loading = false;
  saving = false;

  source = "POS";
  paymentMethod = "CASH";
  paymentStatus = "PENDING";
  additionalDiscount = 0;
  taxAmount = 0;
  paidAmount = 0;
  deliveryContactName = "";
  deliveryPhone = "";
  deliveryAddress = "";
  deliveryNote = "";
  expectedDeliveryDate = "";

  customerSearch = "";
  customerSuggestions: any[] = [];
  selectedCustomer: any = null;

  itemSearch = "";
  productSuggestions: any[] = [];
  selectedItemModels: any[] = [];
  selectedModelVariations: any[] = [];
  selectedModel = "";
  selectedVariation = "";
  selectedVariationId = "";
  selectedVariationSku = "";
  selectedProductId = "";
  selectedModelId = "";
  selectedProductName = "";
  selectedModelName = "";
  selectedColor = "";
  selectedSize = "";
  selectedPrice: number | null = null;
  quantity = 1;
  lineDiscount = 0;

  items: any[] = [];

  private readonly destroy$ = new Subject<void>();
  private readonly itemSearch$ = new Subject<string>();
  private readonly customerSearch$ = new Subject<string>();

  constructor(
    private itemService: ItemService,
    private customerService: CustomerService,
    private orderService: OrderService,
    private snackBar: MatSnackBar,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.itemSearch$
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term) return of({ data: [] });
          return this.itemService.searchProductsForPos(term);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res: any) => {
          this.productSuggestions = Array.isArray(res?.data) ? res.data : [];
        },
        error: () => {
          this.productSuggestions = [];
        },
      });

    this.customerSearch$
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term) return of({ customers: [] });
          return this.customerService.searchCustomers(term);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (res: any) => {
          this.customerSuggestions = Array.isArray(res?.customers) ? res.customers : [];
        },
        error: () => {
          this.customerSuggestions = [];
        },
      });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const productName = `${params?.productName || ""}`.trim();
      if (productName) {
        this.itemSearch = productName;
        this.searchProducts();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  searchProducts(): void {
    this.itemSearch$.next(`${this.itemSearch || ""}`.trim());
  }

  onPaymentStatusChange(): void {
    if (this.paymentStatus === "PAID") {
      this.paidAmount = this.getGrandTotal();
    }
  }

  searchCustomers(): void {
    this.customerSearch$.next(`${this.customerSearch || ""}`.trim());
  }

  selectCustomer(customer: any): void {
    this.selectedCustomer = customer;
    this.customerSearch = `${customer?.name || ""}${customer?.phone ? ` (${customer.phone})` : ""}`;
    this.customerSuggestions = [];
  }

  clearCustomer(): void {
    this.selectedCustomer = null;
    this.customerSearch = "";
    this.customerSuggestions = [];
  }

  selectProductSuggestion(suggestion: any): void {
    this.itemSearch = suggestion?.label || suggestion?.name || "";
    this.selectedProductName = suggestion?.name || suggestion?.label || "";
    this.selectedProductId = suggestion?.productId || "";
    this.selectedItemModels = Array.isArray(suggestion?.models) ? suggestion.models : [];
    this.selectedModel = "";
    this.selectedModelName = "";
    this.selectedModelVariations = [];
    this.selectedVariation = "";
    this.selectedVariationId = "";
    this.selectedVariationSku = "";
    this.selectedPrice = null;
    this.selectedColor = "";
    this.selectedSize = "";
    this.quantity = 1;
    this.lineDiscount = 0;
    this.productSuggestions = [];

    if (this.selectedItemModels.length === 1) {
      const onlyModel = this.selectedItemModels[0];
      this.selectedModel = `${onlyModel?.model || onlyModel?.name || onlyModel?._id || ""}`;
      this.onModelChange();
    }
  }

  onModelChange(): void {
    const modelRow = this.selectedItemModels.find((row: any) => {
      const modelName = `${row?.model || row?.name || ""}`;
      const modelId = `${row?._id || row?.modelId || row?.id || ""}`;
      return modelName === this.selectedModel || modelId === this.selectedModel;
    });

    this.selectedModelVariations = Array.isArray(modelRow?.variations) ? modelRow.variations : [];
    this.selectedModelName = `${modelRow?.model || modelRow?.name || this.selectedModel || ""}`;
    this.selectedVariation = "";
    this.selectedVariationId = "";
    this.selectedVariationSku = "";
    this.selectedPrice = null;
    this.selectedColor = "";
    this.selectedSize = "";

    if (this.selectedModelVariations.length === 1) {
      const onlyVariation = this.selectedModelVariations[0];
      this.selectedVariation = `${onlyVariation?.sku || onlyVariation?.orderNumber || onlyVariation?._id || ""}`;
      this.onVariationChange(this.selectedVariation);
    }
  }

  onVariationChange(value: string): void {
    const variation = this.selectedModelVariations.find((row: any) => {
      return (
        `${row?.sku || ""}` === `${value || ""}` ||
        `${row?.orderNumber || ""}` === `${value || ""}` ||
        `${row?._id || ""}` === `${value || ""}`
      );
    });

    if (!variation) {
      this.selectedVariationId = "";
      this.selectedVariationSku = "";
      this.selectedPrice = null;
      this.selectedColor = "";
      this.selectedSize = "";
      return;
    }

    this.selectedVariationId = variation?._id || "";
    this.selectedVariationSku = variation?.sku || variation?.orderNumber || "";
    this.selectedModelId = variation?.model?._id || variation?.model || "";
    this.selectedPrice = Number(variation?.sellingPrice ?? 0);
    this.selectedColor = variation?.color || variation?.attributes?.color || "";
    this.selectedSize = variation?.size || variation?.attributes?.size || "";
    if (!this.quantity || this.quantity < 1) {
      this.quantity = 1;
    }
  }

  addItem(): void {
    if (!this.selectedProductId || !this.selectedVariationId || !this.selectedPrice || this.quantity <= 0) {
      this.snackBar.open("Select product, variation and quantity first", "Close", { duration: 2400 });
      return;
    }

    const row = {
      productName: this.selectedProductName,
      productId: this.selectedProductId,
      modelName: this.selectedModelName,
      modelId: this.selectedModelId,
      variationId: this.selectedVariationId,
      sku: this.selectedVariationSku,
      quantity: Number(this.quantity || 0),
      sellingPrice: Number(this.selectedPrice || 0),
      discountAmount: Number(this.lineDiscount || 0),
      color: this.selectedColor,
      size: this.selectedSize,
    };

    this.items = [...this.items, row];
    this.resetLineSelection();
  }

  removeItem(index: number): void {
    this.items = this.items.filter((_, i) => i !== index);
  }

  createOrder(): void {
    if (!this.items.length) {
      this.snackBar.open("Add at least one item", "Close", { duration: 2200 });
      return;
    }

    const grandTotal = this.getGrandTotal();
    const safePaidAmount = this.paymentStatus === "PAID" ? grandTotal : Number(this.paidAmount || 0);
    if (safePaidAmount < 0) {
      this.snackBar.open("Paid amount cannot be negative", "Close", { duration: 2200 });
      return;
    }
    if (safePaidAmount > grandTotal) {
      this.snackBar.open("Paid amount cannot exceed total amount", "Close", { duration: 2400 });
      return;
    }

    this.saving = true;
    const payload = {
      customerId: this.selectedCustomer?._id || undefined,
      items: this.items.map((item) => ({
        variationId: item.variationId,
        sku: item.sku,
        quantity: item.quantity,
        sellingPrice: item.sellingPrice,
        discountAmount: item.discountAmount || 0,
      })),
      orderSource: this.source,
      paymentMethod: this.paymentMethod,
      paymentStatus: this.paymentStatus,
      paidAmount: safePaidAmount,
      additionalDiscount: Number(this.additionalDiscount || 0),
      taxAmount: Number(this.taxAmount || 0),
      deliveryContactName: `${this.deliveryContactName || ""}`.trim(),
      deliveryPhone: `${this.deliveryPhone || ""}`.trim(),
      deliveryAddress: `${this.deliveryAddress || ""}`.trim(),
      deliveryNote: `${this.deliveryNote || ""}`.trim(),
      expectedDeliveryDate: this.expectedDeliveryDate || undefined,
      orderStatus: this.source === "POS" ? "CONFIRMED" : "PENDING",
    };

    this.orderService.createOrder(payload).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.snackBar.open(res?.message || "Order created successfully", "Close", { duration: 2400 });
        this.router.navigate(["/order"], { queryParams: { refresh: Date.now() } });
      },
      error: (err) => {
        this.saving = false;
        this.snackBar.open(err?.error?.message || "Failed to create order", "Close", { duration: 3000 });
      },
    });
  }

  getSubTotal(): number {
    return this.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.sellingPrice || 0)), 0);
  }

  getItemDiscountTotal(): number {
    return this.items.reduce((sum, item) => sum + Number(item.discountAmount || 0), 0);
  }

  getGrandTotal(): number {
    return Math.max(
      0,
      this.getSubTotal() - this.getItemDiscountTotal() - Number(this.additionalDiscount || 0) + Number(this.taxAmount || 0),
    );
  }

  getDueAmount(): number {
    if (this.paymentStatus === "PAID") {
      return 0;
    }
    return Math.max(0, this.getGrandTotal() - Number(this.paidAmount || 0));
  }

  private resetLineSelection(): void {
    this.itemSearch = "";
    this.productSuggestions = [];
    this.selectedItemModels = [];
    this.selectedModelVariations = [];
    this.selectedModel = "";
    this.selectedVariation = "";
    this.selectedVariationId = "";
    this.selectedVariationSku = "";
    this.selectedProductId = "";
    this.selectedProductName = "";
    this.selectedModelId = "";
    this.selectedModelName = "";
    this.selectedColor = "";
    this.selectedSize = "";
    this.selectedPrice = null;
    this.quantity = 1;
    this.lineDiscount = 0;
  }
}
