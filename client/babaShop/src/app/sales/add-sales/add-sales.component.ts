import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, Optional, ViewChild } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from "rxjs/operators";
import { of, Subject } from "rxjs";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { CustomerService } from "app/shared/services/customer.service";
import { ItemService } from "app/shared/services/item.service";
import { SalesService } from "app/shared/services/sales.service";
import { StocksService } from "app/shared/services/stocks.service";
import { VariationService } from "app/shared/services/variation.service";
import { AddCustomerDialogComponent } from "../add-customer-dialog/add-customer-dialog.component";

@Component({
  selector: "add-sales",
  templateUrl: "./add-sales.component.html",
  styleUrls: ["./add-sales.component.css"],
})
export class AddSalesComponent implements OnInit, AfterViewInit, OnDestroy {
  Category: any = [];
  Brands: any = [];
  selectedCategory: string = "";
  selectedBrand: string = "";
  availableBrands: any[] = [];
  items: any[] = [];
  itemName: string = "";
  selectedItemModels: any = [];
  customerName: string = "";
  customerPhone: string = "";
  customerAddress: string = "";
  model: string = "";
  variations: string = "";
  quantity: number;
  size: string;
  color: string;
  purchasePrice: number;
  description: string = "";
  billDiscount: number = 0;
  paidAmount: number = 0;
  paymentMethod: "CASH" | "UPI" | "CARD" | "BANK" | "ONLINE" | "CREDIT" = "CASH";
  readonly paymentMethods = ["CASH", "UPI", "CARD", "BANK", "ONLINE", "CREDIT"];
  
  // Split Payment
  splitPayments: { method: string; amount: number }[] = [];
  useSplitPayment: boolean = false;
  
  // Hold/Recall Bills
  heldBills: any[] = [];
  heldBillName: string = "";
  
  Sales_added: any = {};
  final_Sales_data: any = {};
  Display_items: any = {};
  totalPurchasePrice: number = null;
  totalQuantity: number = null;

  suggestions: any[] = [];
  cus_suggestions: string[] = [];
  cus_full_suggestions: any[] = [];
  size_suggestions: string[] = [];
  model_suggestions: string[] = [];

  selectedModel: string = '';
  selectedVariation: string = '';
  selectedModelVariations: any[] = [];
  selectedVariationId: string = "";
  selectedProductId: string = "";
  selectedModelId: string = "";
  selectedVariationSku: string = "";
  currentSelectedVariation: any = null;
  currentAvailableStock: number | null = null;
  scannedBarcode: string = "";
  autoAddOnScan: boolean = true;
  private scanDebounceTimer: any = null;
  barcodeLookupLoading = false;
  private readonly destroy$ = new Subject<void>();
  private readonly itemSearch$ = new Subject<string>();
  private readonly customerSearch$ = new Subject<string>();
  isSavingSale = false;
  @ViewChild("barcodeInputRef") barcodeInputRef?: ElementRef<HTMLInputElement>;

  constructor(
    private category: CategoryService,
    private brand: BrandService,
    private item: ItemService,
    private snackBar: MatSnackBar,
    @Optional() public dialogRef: MatDialogRef<any>,
    public dialog: MatDialog,
    private Sales: SalesService,
    private stock: StocksService,
    private variationService: VariationService,
    private customerService: CustomerService,
  ) {}

  ngOnInit(): void {
    this.loadHeldBillsFromStorage();
    this.setupSuggestionStreams();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.focusBarcodeInput(), 120);
  }

  ngOnDestroy(): void {
    if (this.scanDebounceTimer) {
      clearTimeout(this.scanDebounceTimer);
      this.scanDebounceTimer = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  fetchSuggestions(): void {
    this.itemSearch$.next(`${this.itemName || ""}`.trim());
  }

  selectSuggestion(suggestion: any): void {
    const productName = `${suggestion?.name || suggestion?.label || suggestion || ""}`.trim();
    this.itemName = productName;
    this.selectedItemModels = Array.isArray(suggestion?.models) ? suggestion.models : [];
    this.selectedModel = "";
    this.selectedVariation = "";
    this.selectedModelVariations = [];
    this.selectedVariationId = "";
    this.selectedVariationSku = "";
    this.selectedProductId = `${suggestion?.productId || ""}`.trim();
    this.selectedModelId = "";
    this.model = "";
    this.size = "";
    this.color = "";
    this.purchasePrice = null;
    this.currentSelectedVariation = null;
    this.quantity = this.quantity && this.quantity > 0 ? this.quantity : 1;
    this.suggestions = [];

    if (this.selectedItemModels.length === 1) {
      const onlyModel = this.selectedItemModels[0];
      this.selectedModel = `${onlyModel?.model || onlyModel?.name || onlyModel?._id || ""}`.trim();
      this.updateSelectedModelVariations();
    }
  }

  // Handle customer name change - fetch suggestions
  onCustomerNameChange(value: string): void {
    this.customerName = value;
    this.fetchCusSuggestions();
  }

  fetchCusSuggestions(): void {
    const searchTerm = (this.customerName || "").trim();
    if (!searchTerm) {
      this.cus_suggestions = [];
      this.cus_full_suggestions = [];
      return;
    }

    this.customerSearch$.next(searchTerm);
  }

  selectCusSuggestion(suggestion: string): void {
    let matchedCustomer: any = null;
    
    if (suggestion && typeof suggestion === 'object') {
      matchedCustomer = suggestion;
    } else {
      matchedCustomer = this.cus_full_suggestions.find((c: any) => `${c.name} (${c.phone})` === suggestion);
    }
    
    if (matchedCustomer) {
      // Keep the name, fill phone and address
      this.customerName = matchedCustomer.name || this.customerName || "";
      this.customerPhone = matchedCustomer.phone || "";
      this.customerAddress = matchedCustomer.address || "";
    } else if (typeof suggestion === 'string') {
      // If no match, use the suggestion as name
      this.customerName = suggestion;
    }
    
    this.cus_suggestions = [];
    this.cus_full_suggestions = [];
  }

  // Display function for autocomplete - shows name in input
  displayCustomerFn(customer: any): string {
    if (!customer) return '';
    return customer.name || '';
  }

  onCustomerSelected(event: any): void {
    const customer = event.option.value;
    if (customer) {
      this.customerName = customer.name || '';
      this.customerPhone = customer.phone || '';
      this.customerAddress = customer.address || '';
    }
    // Clear suggestions
    this.cus_suggestions = [];
    this.cus_full_suggestions = [];
  }

  openAddCustomerDialog(): void {
    const dialogRef = this.dialog.open(AddCustomerDialogComponent, {
      width: '400px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.customerName = result.name || "";
        this.customerPhone = result.phone || "";
        this.customerAddress = result.address || "";
        this.snackBar.open(`Customer "${result.name}" added successfully!`, 'Close', { duration: 3000 });
      }
    });
  }

  updateSelectedModelVariations(): void {
    const selectedModelObject = this.selectedItemModels.find((modelRow: any) => {
      const modelName = `${modelRow?.model || modelRow?.name || ""}`;
      const modelId = `${modelRow?._id || modelRow?.id || modelRow?.modelId || ""}`;
      return modelName === this.selectedModel || modelId === this.selectedModel;
    });
    if (selectedModelObject) {
      this.selectedModelVariations = Array.isArray(selectedModelObject.variations) ? selectedModelObject.variations : [];
      this.model = `${selectedModelObject?.model || selectedModelObject?.name || this.selectedModel}`;
      if (this.selectedModelVariations.length === 1) {
        const onlyVariation = this.selectedModelVariations[0];
        this.selectedVariation = `${onlyVariation?.orderNumber || onlyVariation?.sku || onlyVariation?._id || ""}`;
        this.onVariationChange(this.selectedVariation);
      }
    } else {
      this.selectedModelVariations = [];
    }
  }

  onVariationChange(selectedVariation: string): void {
    const selectedVariationObject = this.selectedModelVariations.find(
      (variation: any) =>
        `${variation?.orderNumber || ""}` === `${selectedVariation || ""}` ||
        `${variation?.sku || ""}` === `${selectedVariation || ""}` ||
        `${variation?._id || ""}` === `${selectedVariation || ""}`
    );
  
    if (selectedVariationObject) {
      this.currentSelectedVariation = selectedVariationObject;
      this.size = selectedVariationObject.size || selectedVariationObject?.attributes?.size || "";
      this.color = selectedVariationObject.color || selectedVariationObject?.attributes?.color || "";
      this.selectedVariationId = selectedVariationObject._id || "";
      this.selectedVariationSku = selectedVariationObject.sku || selectedVariationObject.orderNumber || "";
      this.selectedProductId = selectedVariationObject.product?._id || selectedVariationObject.product || "";
      this.selectedModelId = selectedVariationObject.model?._id || selectedVariationObject.model || this.selectedModelId;
      const autoPrice = Number(
        selectedVariationObject?.sellingPrice ??
        selectedVariationObject?.purchasePrice ??
        selectedVariationObject?.costPrice ??
        0
      );
      this.purchasePrice = autoPrice > 0 ? autoPrice : Number(this.purchasePrice || 0);
      if (!this.quantity || this.quantity < 1) {
        this.quantity = 1;
      }
      this.loadCurrentVariationStock(this.selectedVariationId);
    } else {
      this.currentSelectedVariation = null;
      this.size = '';
      this.color = '';
      this.selectedVariationId = "";
      this.selectedVariationSku = "";
      this.selectedProductId = "";
      this.selectedModelId = "";
      this.purchasePrice = null;
      this.currentAvailableStock = null;
    }
  }

  onBarcodeScan(): void {
    const code = (this.scannedBarcode || "").trim();
    if (!code || this.barcodeLookupLoading) return;

    this.barcodeLookupLoading = true;

    this.variationService.getVariations({ barcode: code, limit: 1, skip: 0 }).subscribe({
      next: (res: any) => {
        const row = Array.isArray(res?.data) ? res.data[0] : null;
        if (!row) {
          this.snackBar.open("No variation found for this barcode", "Close", { duration: 2500 });
          this.barcodeLookupLoading = false;
          return;
        }

        this.stock.getStocks({ variation: row?._id, page: 1, limit: 1 }).subscribe({
          next: (stockRes: any) => {
            const stockRow = Array.isArray(stockRes?.stockReport) ? stockRes.stockReport[0] : null;
            const available = this.getAvailableStockFromRow(stockRow);
            if (available <= 0) {
              this.beepError();
              this.snackBar.open(`Out of stock: ${row?.sku || code}`, "Close", { duration: 2600 });
              this.barcodeLookupLoading = false;
              this.scannedBarcode = "";
              this.focusBarcodeInput();
              return;
            }
            
            const activeCustomer = `${this.customerName || ""}`.trim() || "Walk-in";
            const existingQty = Number(
              (this.Sales_added?.[activeCustomer]?.items || [])
              .find((it: any) => `${it?.variationId || ""}` === `${row?._id || ""}`)?.quantity || 0
            );
            if (existingQty >= available) {
              this.beepError();
              this.snackBar.open(`Stock limit reached. Available: ${available}`, "Close", { duration: 2600 });
              this.barcodeLookupLoading = false;
              this.scannedBarcode = "";
              this.focusBarcodeInput();
              return;
            }

            // Fill form fields with fetched data - KEEP FIELDS VISIBLE
            this.itemName = row?.product?.name || this.itemName;
            this.model = row?.model?.name || this.model;
            this.color = row?.attributes?.color || "";
            this.size = row?.attributes?.size || "";
            this.purchasePrice = Number(row?.sellingPrice || 0);
            this.selectedVariationId = row?._id || "";
            this.selectedVariationSku = row?.sku || "";
            this.selectedProductId = row?.product?._id || row?.product || "";
            this.selectedModelId = row?.model?._id || row?.model || "";
            this.variations = row?.sku || "";
            this.currentAvailableStock = available;
            this.applyBarcodeSelection(row);
            if (!this.quantity || this.quantity < 1) {
              this.quantity = 1;
            }

            if (this.autoAddOnScan) {
              const added = this.addCurrentItemToCart("scan");
              if (added) {
                this.beepSuccess(); // Success beep sound
                this.snackBar.open(`Added to cart: ${row?.sku || code}`, "Close", { duration: 1600 });
              }
            } else {
              this.beepSuccess(); // Success beep sound
              this.snackBar.open(`Loaded: ${row?.sku || code}`, "Close", { duration: 1800 });
            }
            this.barcodeLookupLoading = false;
            this.scannedBarcode = "";
            this.focusBarcodeInput();
          },
          error: () => {
            this.beepError();
            this.snackBar.open("Stock check failed", "Close", { duration: 2600 });
            this.barcodeLookupLoading = false;
            this.scannedBarcode = "";
            this.focusBarcodeInput();
          },
        });
      },
      error: () => {
        this.beepError();
        this.snackBar.open("Barcode search failed", "Close", { duration: 2500 });
        this.barcodeLookupLoading = false;
        this.scannedBarcode = "";
        this.focusBarcodeInput();
      },
    });
  }

  private beepError(): void {
    try {
      const audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(220, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (err) {}
  }

  // Success beep sound for barcode scan
  private beepSuccess(): void {
    try {
      const audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch for success
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.08);
    } catch (err) {}
  }

  onBarcodeInputChange(): void {
    const code = (this.scannedBarcode || "").trim();
    if (!code) return;

    if (this.scanDebounceTimer) {
      clearTimeout(this.scanDebounceTimer);
    }
    this.scanDebounceTimer = setTimeout(() => {
      this.onBarcodeScan();
    }, 140);
  }

  private focusBarcodeInput(): void {
    try {
      this.barcodeInputRef?.nativeElement?.focus();
      this.barcodeInputRef?.nativeElement?.select();
    } catch (err) {}
  }

  ProductsByName(data): void {
    this.item.getProductsByName(data).subscribe(
      (response: any) => {
        this.selectedItemModels = Array.isArray(response?.[0]?.models) ? response[0].models : [];
      },
      (error) => console.error("Error retrieving items:", error)
    );
  }

  private applyBarcodeSelection(row: any): void {
    const modelName = `${row?.model?.name || row?.modelName || this.model || ""}`.trim();
    const modelId = `${row?.model?._id || row?.model || ""}`.trim();
    const sku = `${row?.sku || ""}`.trim();
    if (!modelName || !sku) return;

    const barcodeVariation = {
      ...row,
      orderNumber: sku,
      size: row?.attributes?.size || "",
      color: row?.attributes?.color || "",
    };

    const existingModel = (this.selectedItemModels || []).find((m: any) => {
      const name = `${m?.model || m?.name || ""}`.trim();
      const id = `${m?._id || m?.modelId || m?.id || ""}`.trim();
      return name === modelName || (!!modelId && id === modelId);
    });

    if (existingModel) {
      const variations = Array.isArray(existingModel.variations) ? existingModel.variations : [];
      const hasSku = variations.some(
        (v: any) => `${v?.sku || v?.orderNumber || v?._id || ""}` === `${sku || ""}`,
      );
      if (!hasSku) {
        existingModel.variations = [...variations, barcodeVariation];
      }
    } else {
      this.selectedItemModels = [
        ...this.selectedItemModels,
        { _id: modelId || undefined, modelId: modelId || undefined, model: modelName, variations: [barcodeVariation] },
      ];
    }

    this.selectedModel = modelName;
    this.updateSelectedModelVariations();
    this.selectedVariation = sku;
    this.onVariationChange(sku);
  }

  private getAvailableStockFromRow(stockRow: any): number {
    const onHand = Number(stockRow?.quantity || 0);
    const reserved = Number(stockRow?.reservedQuantity || 0);
    const damaged = Number(stockRow?.damagedQuantity || 0);
    return Math.max(0, onHand - reserved - damaged);
  }

  private loadCurrentVariationStock(variationId: string): void {
    const ref = `${variationId || ""}`.trim();
    if (!ref) {
      this.currentAvailableStock = null;
      return;
    }

    this.stock.getStocks({ variation: ref, page: 1, limit: 1 }).subscribe({
      next: (stockRes: any) => {
        const stockRow = Array.isArray(stockRes?.stockReport) ? stockRes.stockReport[0] : null;
        this.currentAvailableStock = this.getAvailableStockFromRow(stockRow);
      },
      error: () => {
        this.currentAvailableStock = null;
      },
    });
  }

  async onSubmit(): Promise<void> {
    this.addCurrentItemToCart("manual");
  }

  private addCurrentItemToCart(source: "manual" | "scan"): boolean {
    const normalizedCustomer = `${this.customerName || ""}`.trim() || "Walk-in";
    this.customerName = normalizedCustomer;

    if (!this.itemName || !this.selectedVariationId) {
      if (source === "manual") {
        this.snackBar.open("Select item variation first", "Close", { duration: 2200 });
      }
      return false;
    }
    if (!this.quantity || Number(this.quantity) <= 0) {
      if (source === "manual") {
        this.snackBar.open("Quantity must be greater than 0", "Close", { duration: 2200 });
      }
      return false;
    }
    if (Number(this.purchasePrice || 0) < 0) {
      if (source === "manual") {
        this.snackBar.open("Price cannot be negative", "Close", { duration: 2200 });
      }
      return false;
    }

    const activeCustomerItems = this.Sales_added[normalizedCustomer]?.items || [];
    const existingQty = Number(
      activeCustomerItems.find((it: any) => `${it?.variationId || ""}` === `${this.selectedVariationId || ""}`)?.quantity || 0,
    );
    const requestedQty = Number(this.quantity || 0);
    const availableStock = Number(this.currentAvailableStock ?? this.currentSelectedVariation?.quantity ?? 0);

    if (availableStock <= 0) {
      this.snackBar.open(`Out of stock: ${this.selectedVariationSku || this.selectedVariationId}`, "Close", {
        duration: 2400,
      });
      return false;
    }

    if (existingQty + requestedQty > availableStock) {
      this.snackBar.open(`Stock limit reached. Available: ${availableStock}`, "Close", {
        duration: 2600,
      });
      return false;
    }

    let customerSales = this.Sales_added[this.customerName];
    const itemRow = {
      itemName: this.itemName,
      category: this.selectedCategory,
      brand: this.selectedBrand,
      quantity: Number(this.quantity || 0),
      purchasePrice: Number(this.purchasePrice || 0),
      model: this.model,
      size: this.size,
      color: this.color,
      variations: this.selectedVariationSku || this.variations,
      variationId: this.selectedVariationId || null,
      variationSku: this.selectedVariationSku || this.variations || null,
      productId: this.selectedProductId || null,
      modelId: this.selectedModelId || null,
    };

    if (!customerSales) {
      customerSales = {
        customerName: this.customerName,
        items: [itemRow],
        totalPurchasePrice: itemRow.quantity * itemRow.purchasePrice,
        totalQuantity: itemRow.quantity,
      };
      this.Sales_added[this.customerName] = customerSales;
    } else {
      const existingIndex = source === "scan"
        ? customerSales.items.findIndex((it: any) => `${it?.variationId || ""}` !== "" && `${it?.variationId || ""}` === `${itemRow.variationId || ""}`)
        : -1;

      if (existingIndex >= 0) {
        const existing = customerSales.items[existingIndex];
        existing.quantity = Number(existing.quantity || 0) + Number(itemRow.quantity || 0);
        existing.purchasePrice = Number(itemRow.purchasePrice || existing.purchasePrice || 0);
        existing.model = itemRow.model || existing.model;
        existing.size = itemRow.size || existing.size;
        existing.color = itemRow.color || existing.color;
        existing.variationSku = itemRow.variationSku || existing.variationSku;
        existing.variations = itemRow.variations || existing.variations;
      } else {
        customerSales.items.push(itemRow);
      }
    }
    
    customerSales.totalQuantity = (customerSales.items || []).reduce((acc: number, it: any) => acc + Number(it?.quantity || 0), 0);
    customerSales.totalPurchasePrice = (customerSales.items || []).reduce((acc: number, it: any) => acc + Number(it?.quantity || 0) * Number(it?.purchasePrice || 0), 0);

    this.final_Sales_data = {
      customerName: this.customerName,
      items: customerSales.items,
      billDiscount: Number(this.billDiscount || 0),
      paidAmount: Number(this.paidAmount || 0),
      paymentMethod: this.paymentMethod || "CASH",
    };
    this.Display_items = this.final_Sales_data.items;
    this.calculateTotals();

    // Keep fields visible after scan - don't reset
    return true;
  }

  removeItem(index: number) {
    this.Display_items.splice(index, 1);
    this.calculateTotals();
  }

  calculateTotals() {
    this.totalQuantity = 0;
    this.totalPurchasePrice = 0;
    for (const item of this.Display_items) {
      this.totalQuantity += item.quantity;
      this.totalPurchasePrice += item.quantity * item.purchasePrice;
    }
  }

  getNetTotal(): number {
    return Math.max(0, Number(this.totalPurchasePrice || 0) - Number(this.billDiscount || 0));
  }

  getDueAmount(): number {
    return Math.max(0, this.getNetTotal() - Number(this.paidAmount || 0));
  }

  canSaveSale(): boolean {
    const hasItems = this.Display_items && this.Display_items.length > 0;
    const hasCustomer = (this.customerName || "").trim().length > 0;
    return hasItems && hasCustomer;
  }

  onSales() {
    if (!Array.isArray(this.Display_items) || this.Display_items.length === 0) {
      this.snackBar.open("Add at least one item before save", "Close", { duration: 2500 });
      return;
    }

    const customerName = (this.customerName || "").trim();
    if (!customerName) {
      this.snackBar.open("Customer name is required", "Close", { duration: 2500 });
      return;
    }

    const net = this.getNetTotal();
    const paidAmount = Number(this.paidAmount || 0);
    
    if (paidAmount < 0) {
      this.snackBar.open("Paid amount cannot be negative", "Close", { duration: 2500 });
      return;
    }

    if (paidAmount > net) {
      this.snackBar.open("Paid amount cannot be greater than net total", "Close", { duration: 2600 });
      return;
    }

    let finalPaidAmount = this.paidAmount;
    let finalPaymentMethod = this.paymentMethod;
    
    if (this.useSplitPayment && this.splitPayments.length > 0) {
      const totalSplitAmount = this.splitPayments.reduce((sum, sp) => sum + (sp.amount || 0), 0);
      if (totalSplitAmount !== net) {
        this.snackBar.open("Split payment total must equal bill amount", "Close", { duration: 2500 });
        return;
      }
      finalPaymentMethod = this.splitPayments[0].method as "CASH" | "UPI" | "CARD" | "BANK" | "ONLINE" | "CREDIT";
      finalPaidAmount = totalSplitAmount;
    }

    this.final_Sales_data = {
      customerName: customerName,
      customerPhone: this.customerPhone || "",
      customerAddress: this.customerAddress || "",
      items: (this.Display_items || []).map((it: any) => ({
        itemName: it?.itemName,
        category: it?.category || null,
        brand: it?.brand || null,
        quantity: Number(it?.quantity || 0),
        purchasePrice: Number(it?.purchasePrice || 0),
        model: it?.model || "",
        size: it?.size || "",
        variations: it?.variations || it?.variationSku || null,
        variationId: it?.variationId || null,
        variationSku: it?.variationSku || it?.variations || null,
        productId: it?.productId || null,
        modelId: it?.modelId || null,
      })),
      billDiscount: Number(this.billDiscount || 0),
      paidAmount: Number(finalPaidAmount || 0),
      paymentMethod: finalPaymentMethod || "CASH",
      splitPayments: this.useSplitPayment ? this.splitPayments : null
    };

    if (this.isSavingSale) {
      return;
    }

    this.isSavingSale = true;
    this.Sales.addSales(this.final_Sales_data).subscribe(
      (response: any) => {
        this.snackBar.open(response?.message || "Sale saved", "Close", { duration: 3200, horizontalPosition: "center", verticalPosition: "bottom" });
        this.resetForm();
        this.isSavingSale = false;
        this.dialogRef?.close(true);
      },
      (error: any) => {
        console.error("Error adding Sales item:", error);
        this.snackBar.open(error?.error?.message || "Failed to add sales item", "Close", { duration: 4000, horizontalPosition: "center", verticalPosition: "bottom" });
        this.isSavingSale = false;
      }
    );
  }

  // HOLD/RECALL BILLS
  holdBill(): void {
    if (!this.Display_items || this.Display_items.length === 0) {
      this.snackBar.open("No items to hold", "Close", { duration: 2000 });
      return;
    }
    
    const billName = this.heldBillName || `Bill ${new Date().toLocaleTimeString()}`;
    const heldBill = {
      id: Date.now(),
      name: billName,
      customerName: this.customerName || "Walk-in",
      customerPhone: this.customerPhone || "",
      customerAddress: this.customerAddress || "",
      items: JSON.parse(JSON.stringify(this.Display_items)),
      billDiscount: this.billDiscount || 0,
      paidAmount: this.paidAmount || 0,
      paymentMethod: this.paymentMethod || "CASH",
      heldAt: new Date()
    };
    
    this.heldBills.push(heldBill);
    this.saveHeldBillsToStorage();
    this.snackBar.open(`Bill "${billName}" held successfully!`, 'Close', { duration: 2000 });
    this.clearCart();
    this.heldBillName = "";
  }
  
  recallBill(bill: any): void {
    if (!bill) return;
    
    if (this.Display_items && this.Display_items.length > 0) {
      if (!confirm("Current cart has items. Replace with held bill?")) {
        return;
      }
    }
    
    this.customerName = bill.customerName || "";
    this.customerPhone = bill.customerPhone || "";
    this.customerAddress = bill.customerAddress || "";
    this.Display_items = JSON.parse(JSON.stringify(bill.items));
    this.billDiscount = bill.billDiscount || 0;
    this.paidAmount = bill.paidAmount || 0;
    this.paymentMethod = bill.paymentMethod || "CASH";
    
    this.calculateTotals();
    this.snackBar.open(`Bill "${bill.name}" loaded!`, 'Close', { duration: 2000 });
  }
  
  deleteHeldBill(billId: number): void {
    this.heldBills = this.heldBills.filter(b => b.id !== billId);
    this.saveHeldBillsToStorage();
    this.snackBar.open("Held bill deleted", 'Close', { duration: 2000 });
  }
  
  private saveHeldBillsToStorage(): void {
    try {
      localStorage.setItem('heldBills', JSON.stringify(this.heldBills));
    } catch (e) {
      console.error("Error saving held bills:", e);
    }
  }
  
  loadHeldBillsFromStorage(): void {
    try {
      const saved = localStorage.getItem('heldBills');
      if (saved) {
        this.heldBills = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error loading held bills:", e);
    }
  }
  
  clearCart(): void {
    this.customerName = "";
    this.customerPhone = "";
    this.customerAddress = "";
    this.Display_items = [];
    this.billDiscount = 0;
    this.paidAmount = 0;
    this.paymentMethod = "CASH";
    this.totalQuantity = 0;
    this.totalPurchasePrice = 0;
    this.useSplitPayment = false;
    this.splitPayments = [];
  }

  setPaymentMethod(method: "CASH" | "UPI" | "CARD" | "BANK" | "ONLINE" | "CREDIT"): void {
    this.paymentMethod = method;
    if (!this.useSplitPayment) {
      this.paidAmount = this.getNetTotal();
    }
  }

  getLineTotal(item: any): number {
    return Number(item?.quantity || 0) * Number(item?.purchasePrice || 0);
  }
  
  // SPLIT PAYMENT
  toggleSplitPayment(): void {
    this.useSplitPayment = !this.useSplitPayment;
    if (this.useSplitPayment) {
      this.splitPayments = [{ method: "CASH", amount: 0 }];
    } else {
      this.splitPayments = [];
    }
  }
  
  addSplitPaymentRow(): void {
    this.splitPayments.push({ method: "CASH", amount: 0 });
  }
  
  removeSplitPaymentRow(index: number): void {
    if (this.splitPayments.length > 1) {
      this.splitPayments.splice(index, 1);
    }
  }
  
  getSplitPaymentTotal(): number {
    return this.splitPayments.reduce((sum, sp) => sum + (sp.amount || 0), 0);
  }
  
  getBillTotal(bill: any): number {
    if (!bill || !bill.items) return 0;
    return bill.items.reduce((sum: number, item: any) => sum + (item.quantity * item.purchasePrice), 0);
  }
  
  private resetForm(): void {
    this.clearCart();
    this.heldBillName = "";
  }

  private setupSuggestionStreams(): void {
    this.itemSearch$
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term) {
            return of([]);
          }
          return this.item.searchProductsForPos(term);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response: any) => {
          this.suggestions = Array.isArray(response?.data) ? response.data : [];
        },
        error: () => {
          this.suggestions = [];
        },
      });

    this.customerSearch$
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term) {
            return of({ success: true, customers: [] });
          }
          return this.customerService.searchCustomers(term);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response: any) => {
          if (response?.success && Array.isArray(response.customers)) {
            this.cus_full_suggestions = response.customers;
            this.cus_suggestions = response.customers.map((c: any) => `${c.name} (${c.phone})`);
            return;
          }

          this.cus_suggestions = [];
          this.cus_full_suggestions = [];
        },
        error: () => {
          this.cus_suggestions = [];
          this.cus_full_suggestions = [];
        },
      });
  }
}
