import { AfterViewInit, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Optional, Output, ViewChild } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ActivatedRoute, Router } from "@angular/router";
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from "rxjs/operators";
import { of, Subject } from "rxjs";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { CustomerService } from "app/shared/services/customer.service";
import { ItemService } from "app/shared/services/item.service";
import { SalesService } from "app/shared/services/sales.service";
import { ShopService } from "app/shared/services/shop.service";
import { StocksService } from "app/shared/services/stocks.service";
import { VariationService } from "app/shared/services/variation.service";
import { AuthService } from "app/shared/services/auth.service";
import { AddCustomerDialogComponent } from "../add-customer-dialog/add-customer-dialog.component";

@Component({
  selector: "add-sales",
  templateUrl: "./add-sales.component.html",
  styleUrls: ["./add-sales.component.css"],
})
export class AddSalesComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() exitRequested = new EventEmitter<void>();
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
  selectedCustomerId: string = "";
  currentCustomerWalletBalance: number = 0;
  walletUsedAmount: number = 0;
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
  saleDate: Date | null = null;
  readonly paymentMethods = ["CASH", "UPI", "CARD", "BANK", "ONLINE", "CREDIT"];
  readonly splitPaymentMethods = ["CASH", "UPI", "CARD", "BANK", "ONLINE"];
  
  // Split Payment
  splitPayments: { method: string; amount: number }[] = [];
  useSplitPayment: boolean = false;
  
  // Hold/Recall Bills
  heldBills: any[] = [];
  heldBillName: string = "";
  heldBillSearch: string = "";
  
  Sales_added: any = {};
  final_Sales_data: any = {};
  Display_items: any = {};
  totalPurchasePrice: number = null;
  totalQuantity: number = null;

  suggestions: any[] = [];
  activeSuggestionIndex = -1;
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
  private primarySearchScanTimer: any = null;
  barcodeLookupLoading = false;
  itemSearchLoading = false;
  activeShopDetails: any = null;
  private readonly destroy$ = new Subject<void>();
  today = new Date();
  private readonly itemSearch$ = new Subject<string>();
  private readonly customerSearch$ = new Subject<string>();
  isSavingSale = false;
  private lastAutoHoldSignature = "";
  
  get canBackdateSale(): boolean {
    const role = this.authService.getUserRole();
    return role === "ADMIN" || role === "SUPER_ADMIN";  
  }

  get minDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }

  setBackDate(daysAgo: number): void {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    this.saleDate = date;
  }
  
  private readonly salesDraftStorageKey = "posSalesDraft";
  private readonly onlineStatusHandler = () => this.handleOnlineStatusChange();
  @ViewChild("barcodeInputRef") barcodeInputRef?: ElementRef<HTMLInputElement>;
  editMode = false;
  editSaleId = "";
  originalSaleDate: string = "";

  constructor(
    private category: CategoryService,
    private brand: BrandService,
    private item: ItemService,
    private snackBar: MatSnackBar,
    @Optional() public dialogRef: MatDialogRef<any>,
    public dialog: MatDialog,
    private Sales: SalesService,
    private shopService: ShopService,
    private stock: StocksService,
    private variationService: VariationService,
    private customerService: CustomerService,
    public authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.editSaleId = this.route.snapshot.paramMap.get("id") || "";
    if (this.editSaleId) {
      this.editMode = true;
      this.loadSaleForEdit(this.editSaleId);
    }

    this.loadHeldBillsFromStorage();
    this.restoreDraftFromStorage();
    this.loadSelectedShopDetails();
    this.shopService.selectedShop$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadSelectedShopDetails();
    });
    window.addEventListener("offline", this.onlineStatusHandler);
    window.addEventListener("online", this.onlineStatusHandler);
    this.setupSuggestionStreams();
    this.itemSearch$.next("");
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.focusBarcodeInput(), 120);
  }

  ngOnDestroy(): void {
    if (this.scanDebounceTimer) {
      clearTimeout(this.scanDebounceTimer);
      this.scanDebounceTimer = null;
    }
    if (this.primarySearchScanTimer) {
      clearTimeout(this.primarySearchScanTimer);
      this.primarySearchScanTimer = null;
    }
    window.removeEventListener("offline", this.onlineStatusHandler);
    window.removeEventListener("online", this.onlineStatusHandler);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSelectedShopDetails(): void {
    const selectedShopId = this.authService.getShopId();
    if (!selectedShopId) {
      this.activeShopDetails = null;
      return;
    }

    this.shopService.getShopById(selectedShopId).subscribe({
      next: (res: any) => {
        this.activeShopDetails = res?.data || null;
      },
      error: () => {
        this.activeShopDetails = null;
      },
    });
  }

  private loadSaleForEdit(id: string): void {
    this.Sales.getSaleById(id).subscribe({
      next: (res: any) => {
        const sale = res?.data || res;
        if (!sale) {
          this.snackBar.open("Sale not found", "Close", { duration: 3000 });
          this.router.navigate(["/sale-list"]);
          return;
        }
        console.log("Sale loaded for edit, billDiscount:", sale.billDiscount);
        this.customerName = sale.customerName || "";
        this.customerPhone = sale.customerPhone || "";
        this.customerAddress = sale.customerAddress || "";
        this.selectedCustomerId = sale.customer || "";
        this.billDiscount = sale.billDiscount || 0;
        this.description = sale.description || "";
        const items = (sale.items || []).map((it: any) => ({
          ...it,
          purchasePrice: it.sellingPrice ?? it.purchasePrice
        }));
        this.Display_items = items;
        this.paidAmount = sale.paidAmount || 0;
        this.paymentMethod = sale.paymentMethod || "CASH";
        this.billDiscount = sale.billDiscount || 0;
        this.originalSaleDate = sale.createdAt || sale.saleDate || "";
        
        this.rebuildSalesStateFromDisplayItems();
        this.onPaidAmountChange();
        this.snackBar.open("Sale loaded for editing", "Close", { duration: 2000 });
      },
      error: () => {
        this.snackBar.open("Failed to load sale", "Close", { duration: 3000 });
        this.router.navigate(["/sale-list"]);
      },
    });
  }

  fetchSuggestions(): void {
    const term = `${this.itemName || ""}`.trim();
    if (this.primarySearchScanTimer) {
      clearTimeout(this.primarySearchScanTimer);
      this.primarySearchScanTimer = null;
    }

    if (!term) {
      this.suggestions = [];
      this.activeSuggestionIndex = -1;
      this.itemSearchLoading = false;
      this.itemSearch$.next("");
      return;
    }

    if (this.looksLikeScannableCode(term)) {
      this.suggestions = [];
      this.activeSuggestionIndex = -1;
      this.itemSearchLoading = false;
      this.primarySearchScanTimer = setTimeout(() => {
        if (`${this.itemName || ""}`.trim() !== term) return;
        this.scannedBarcode = term;
        this.onBarcodeScan("primary");
      }, 160);
      return;
    }

    this.itemSearch$.next(term);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.suggestions?.length) {
      if (event.key === "Escape") {
        this.activeSuggestionIndex = -1;
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.activeSuggestionIndex = (this.activeSuggestionIndex + 1 + this.suggestions.length) % this.suggestions.length;
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.activeSuggestionIndex =
        this.activeSuggestionIndex <= 0 ? this.suggestions.length - 1 : this.activeSuggestionIndex - 1;
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selectedSuggestion = this.suggestions[this.activeSuggestionIndex >= 0 ? this.activeSuggestionIndex : 0];
      if (selectedSuggestion) {
        this.applySuggestionFromKeyboard(selectedSuggestion);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      this.suggestions = [];
      this.activeSuggestionIndex = -1;
    }
  }

  private applySuggestionFromKeyboard(suggestion: any): void {
    if (this.canQuickAddSuggestion(suggestion)) {
      this.quickAddSuggestion(undefined, suggestion);
      return;
    }

    this.selectSuggestion(suggestion);
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
    this.activeSuggestionIndex = -1;

    if (this.selectedItemModels.length === 1) {
      const onlyModel = this.selectedItemModels[0];
      this.selectedModel = `${onlyModel?.model || onlyModel?.name || onlyModel?._id || ""}`.trim();
      this.updateSelectedModelVariations();
    }
  }

  canQuickAddSuggestion(suggestion: any): boolean {
    const models = Array.isArray(suggestion?.models) ? suggestion.models : [];
    if (models.length !== 1) return false;
    const variations = Array.isArray(models[0]?.variations) ? models[0].variations : [];
    return variations.length === 1;
  }

  getQuickAddSuggestionLabel(suggestion: any): string {
    if (!this.canQuickAddSuggestion(suggestion)) {
      return "Select";
    }

    const variation = suggestion?.models?.[0]?.variations?.[0];
    return variation?.sku || variation?.orderNumber ? `Quick Add ${variation.sku || variation.orderNumber}` : "Quick Add";
  }

  quickAddSuggestion(event: Event | undefined, suggestion: any): void {
    event?.stopPropagation();
    this.selectSuggestion(suggestion);
    if (!this.canQuickAddSuggestion(suggestion)) {
      return;
    }

    const onlyVariation = suggestion?.models?.[0]?.variations?.[0];
    const variationValue = onlyVariation?.orderNumber || onlyVariation?.sku || onlyVariation?._id || "";
    if (!variationValue) {
      return;
    }

    this.selectedVariation = `${variationValue}`;
    this.onVariationChange(this.selectedVariation);
    this.quantity = 1;
    const added = this.addCurrentItemToCart("manual");
    if (added) {
      this.snackBar.open(`Added ${suggestion?.label || suggestion?.name || "item"} to cart`, "Close", { duration: 1800 });
    }
  }

  // Handle customer name change - fetch suggestions
  onCustomerNameChange(value: string): void {
    this.customerName = value;
    this.selectedCustomerId = "";
    this.currentCustomerWalletBalance = 0;
    this.walletUsedAmount = 0;
    this.fetchCusSuggestions();
    this.saveDraftToStorage();
  }

  fetchCusSuggestions(): void {
    const searchTerm = (this.customerName || "").trim();
    if (!searchTerm) {
      this.cus_full_suggestions = [];
      return;
    }

    this.customerSearch$.next(searchTerm);
  }

  selectCusSuggestion(suggestion: any): void {
    const matchedCustomer = suggestion && typeof suggestion === "object"
      ? suggestion
      : null;

    if (matchedCustomer) {
      this.customerName = matchedCustomer.name || this.customerName || "";
      this.customerPhone = matchedCustomer.phone || "";
      this.customerAddress = matchedCustomer.address || "";
      this.selectedCustomerId = matchedCustomer._id || "";
      this.currentCustomerWalletBalance = Number(matchedCustomer.walletBalance || 0);
      this.syncWalletUsage();
    }

    this.cus_full_suggestions = [];
    this.saveDraftToStorage();
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
      this.selectedCustomerId = customer._id || "";
      this.currentCustomerWalletBalance = Number(customer.walletBalance || 0);
      this.syncWalletUsage();
    }
    this.cus_full_suggestions = [];
    this.saveDraftToStorage();
  }

  openAddCustomerDialog(): void {
    const canManageCustomers = this.authService.can("people.customers.manage") ||
      (this.authService.getUserRole() === "STAFF" && this.authService.can("people.customers"));

    if (!canManageCustomers) {
      this.snackBar.open("Customer add/edit access is not enabled for this role.", "Close", { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(AddCustomerDialogComponent, {
      width: '400px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.customerName = result.name || "";
        this.customerPhone = result.phone || "";
        this.customerAddress = result.address || "";
        this.selectedCustomerId = result._id || "";
        this.currentCustomerWalletBalance = Number(result.walletBalance || 0);
        this.walletUsedAmount = 0;
        this.saveDraftToStorage();
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

  onBarcodeScan(source: "barcode" | "primary" = "barcode"): void {
    const code = (this.scannedBarcode || "").trim();
    if (!code || this.barcodeLookupLoading) return;

    this.barcodeLookupLoading = true;

    this.variationService.getVariations({ barcode: code, limit: 1, skip: 0 }).subscribe({
      next: (res: any) => {
        const row = Array.isArray(res?.data) ? res.data[0] : null;
        if (!row) {
          if (source === "primary") {
            this.itemName = code;
          }
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
    if (!this.looksLikeScannableCode(code)) return;

    if (this.scanDebounceTimer) {
      clearTimeout(this.scanDebounceTimer);
    }
    this.scanDebounceTimer = setTimeout(() => {
      this.onBarcodeScan();
    }, 140);
  }

  private looksLikeScannableCode(value: string): boolean {
    const term = `${value || ""}`.trim();
    if (term.length < 6 || /\s/.test(term)) {
      return false;
    }

    const hasDigit = /\d/.test(term);
    const hasSeparator = /[-_/]/.test(term);
    const allUpper = term === term.toUpperCase() && /[A-Z]/.test(term);
    const mostlyNumeric = /^[0-9A-Z-_/]+$/.test(term);
    return mostlyNumeric && (hasDigit || hasSeparator || allUpper);
  }

  clearSearchInput(): void {
    this.itemName = "";
    this.suggestions = [];
    this.activeSuggestionIndex = -1;
    this.itemSearchLoading = false;
  }

  clearBarcodeInput(): void {
    this.scannedBarcode = "";
    this.focusBarcodeInput();
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
      availableStock: Number.isFinite(availableStock) ? availableStock : null,
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
    this.saveDraftToStorage();

    // Keep fields visible after scan - don't reset
    return true;
  }

  removeItem(index: number) {
    this.Display_items.splice(index, 1);
    this.rebuildSalesStateFromDisplayItems();
  }

  changeCartItemQuantity(index: number, delta: number): void {
    const item = this.Display_items?.[index];
    if (!item) return;

    const nextQty = Number(item.quantity || 0) + Number(delta || 0);
    if (nextQty <= 0) {
      this.removeItem(index);
      return;
    }

    const availableStock = Number(item?.availableStock ?? item?.stockAvailable ?? Infinity);
    if (Number.isFinite(availableStock) && nextQty > availableStock) {
      this.snackBar.open(`Stock limit reached. Available: ${availableStock}`, "Close", { duration: 2400 });
      return;
    }

    item.quantity = nextQty;
    this.rebuildSalesStateFromDisplayItems();
  }

  calculateTotals() {
    this.totalQuantity = 0;
    this.totalPurchasePrice = 0;
    for (const item of this.Display_items) {
      this.totalQuantity += item.quantity;
      this.totalPurchasePrice += item.quantity * item.purchasePrice;
    }
    this.normalizeBillingInputs();
    this.syncWalletUsage();
    if (this.useSplitPayment) {
      this.normalizeSplitPayments();
    }
  }

  getNetTotal(): number {
    return Math.max(0, Number(this.totalPurchasePrice || 0) - Number(this.billDiscount || 0));
  }

  getCollectedNonWalletTotal(): number {
    if (this.useSplitPayment) {
      return this.getSplitPaymentTotal();
    }
    return Math.max(0, Number(this.paidAmount || 0));
  }

  getRemainingForSplitRows(): number {
    return Math.max(0, this.getNetTotal() - Number(this.walletUsedAmount || 0));
  }

  getMaxWalletUsable(): number {
    const wallet = Math.max(0, Number(this.currentCustomerWalletBalance || 0));
    const remainingAfterCash = Math.max(0, this.getNetTotal() - this.getCollectedNonWalletTotal());
    return Math.max(0, Math.min(wallet, remainingAfterCash));
  }

  private syncWalletUsage(): void {
    const maxWalletUsable = this.getMaxWalletUsable();
    this.walletUsedAmount = Math.max(0, Math.min(Number(this.walletUsedAmount || 0), maxWalletUsable));
  }

  onBillDiscountChange(value?: number | string, inputEl?: HTMLInputElement | null): void {
    this.billDiscount = Math.max(0, Number(value ?? this.billDiscount ?? 0));
    this.normalizeBillingInputs();
    if (this.useSplitPayment) {
      this.normalizeSplitPayments();
    }
    this.syncNumericInputValue(inputEl, this.billDiscount);
    this.saveDraftToStorage();
  }

  onWalletAmountChange(value?: number | string, inputEl?: HTMLInputElement | null): void {
    this.walletUsedAmount = Math.max(0, Number(value ?? this.walletUsedAmount ?? 0));
    this.syncWalletUsage();
    if (this.useSplitPayment) {
      this.normalizeSplitPayments();
    }
    this.onPaidAmountChange();
    this.syncNumericInputValue(inputEl, this.walletUsedAmount);
    this.saveDraftToStorage();
  }

  onPaidAmountChange(value?: number | string, inputEl?: HTMLInputElement | null): void {
    if (this.useSplitPayment) {
      this.normalizeSplitPayments();
      this.syncWalletUsage();
      this.saveDraftToStorage();
      return;
    }
    this.paidAmount = Math.max(0, Number(value ?? this.paidAmount ?? 0));
    this.normalizeBillingInputs();
    const netTotal = this.getNetTotal();
    const safePaid = Math.max(0, Number(this.paidAmount || 0));
    const maxCashAllowed = Math.max(0, netTotal - Number(this.walletUsedAmount || 0));
    const clampedPaid = Math.min(safePaid, maxCashAllowed);
    if (clampedPaid !== safePaid) {
      this.paidAmount = clampedPaid;
    }
    this.syncWalletUsage();
    this.syncNumericInputValue(inputEl, this.paidAmount);
    this.saveDraftToStorage();
  }

  private normalizeBillingInputs(): void {
    const subtotal = Math.max(0, Number(this.totalPurchasePrice || 0));
    this.billDiscount = Math.max(0, Math.min(Number(this.billDiscount || 0), subtotal));
  }

  private syncNumericInputValue(inputEl: HTMLInputElement | null | undefined, value: number): void {
    if (!inputEl) return;
    inputEl.value = `${Number(value || 0)}`;
  }

  getDueAmount(): number {
    return Math.max(0, this.getNetTotal() - this.getCollectedNonWalletTotal() - Number(this.walletUsedAmount || 0));
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

    if (!this.useSplitPayment && paidAmount > net) {
      this.snackBar.open("Paid amount cannot be greater than net total", "Close", { duration: 2600 });
      return;
    }
    this.syncWalletUsage();
    const walletUsedAmount = Number(this.walletUsedAmount || 0);
    if (walletUsedAmount < 0) {
      this.snackBar.open("Wallet amount cannot be negative", "Close", { duration: 2500 });
      return;
    }
    if (walletUsedAmount > Number(this.currentCustomerWalletBalance || 0)) {
      this.snackBar.open("Wallet amount exceeds customer wallet balance", "Close", { duration: 2600 });
      return;
    }
    if (!this.useSplitPayment && paidAmount + walletUsedAmount > net) {
      this.snackBar.open("Paid amount plus wallet cannot be greater than net total", "Close", { duration: 2600 });
      return;
    }

    let finalPaidAmount = this.paidAmount;
    let finalPaymentMethod: "CASH" | "UPI" | "CARD" | "BANK" | "ONLINE" | "CREDIT" | "SPLIT" = this.paymentMethod;
    
    if (this.useSplitPayment && this.splitPayments.length > 0) {
      const totalSplitAmount = Number(this.getSplitPaymentTotal().toFixed(2));
      const expectedSplitAmount = Number(Math.max(0, net - walletUsedAmount).toFixed(2));
      if (Math.abs(totalSplitAmount - expectedSplitAmount) > 0.01) {
        this.snackBar.open("Split payment total must match remaining bill after wallet use", "Close", { duration: 2500 });
        return;
      }
      finalPaymentMethod = this.getResolvedSalePaymentMethod();
      finalPaidAmount = totalSplitAmount;
    }

    const itemTotal = (this.Display_items || []).reduce((sum: number, it: any) => sum + (Number(it?.quantity || 0) * Number(it?.sellingPrice || it?.purchasePrice || 0)), 0);
    this.final_Sales_data = {
      customerName: customerName,
      customer: this.selectedCustomerId || null,
      customerPhone: this.customerPhone || "",
      customerAddress: this.customerAddress || "",
      items: (this.Display_items || []).map((it: any) => ({
        itemName: it?.itemName,
        category: it?.category || null,
        brand: it?.brand || null,
        quantity: Number(it?.quantity || 0),
        purchasePrice: Number(it?.purchasePrice || 0),
        sellingPrice: Number(it?.sellingPrice || it?.purchasePrice || 0),
        model: it?.model || "",
        size: it?.size || "",
        variations: it?.variations || it?.variationSku || null,
        variationId: it?.variationId || null,
        variationSku: it?.variationSku || it?.variations || null,
        productId: it?.productId || null,
        modelId: it?.modelId || null,
      })),
      itemTotal,
      billDiscount: Number(this.billDiscount || 0),
      paidAmount: Number(finalPaidAmount || 0),
      walletUsedAmount: walletUsedAmount,
      paymentMethod: finalPaymentMethod || "CASH",
      splitPayments: this.useSplitPayment ? this.splitPayments : null,
      ...(this.saleDate && this.canBackdateSale ? { saleDate: this.formatDateForApi(this.saleDate) } : {}),
      ...(this.editMode && this.originalSaleDate ? { createdAt: this.originalSaleDate } : {}),
    };
    console.log("Final payload:", JSON.stringify(this.final_Sales_data, null, 2));

    if (this.isSavingSale) {
      return;
    }

    this.isSavingSale = true;
    
    const saveObservable = this.editMode 
      ? this.Sales.updateSale(this.editSaleId, this.final_Sales_data)
      : this.Sales.addSales(this.final_Sales_data);

    saveObservable.subscribe(
      (response: any) => {
        this.snackBar.open(response?.message || (this.editMode ? "Sale updated" : "Sale saved"), "Close", { duration: 3200, horizontalPosition: "center", verticalPosition: "bottom" });
        if (!this.editMode) {
          this.resetForm();
          this.lastAutoHoldSignature = "";
        }
        this.clearDraftFromStorage();
        this.isSavingSale = false;
        this.dialogRef?.close(true);
        if (this.editMode) {
          this.router.navigate(["/sale-list"]);
        }
      },
      (error: any) => {
        console.error(this.editMode ? "Error updating Sales item:" : "Error adding Sales item:", error);
        const errMsg = error?.error?.message || error?.message || (this.editMode ? "Failed to update sale" : "Failed to add sales item");
        this.snackBar.open(errMsg, "Close", { duration: 4000, horizontalPosition: "center", verticalPosition: "bottom" });
        this.isSavingSale = false;
      }
    );
  }

  // HOLD/RECALL BILLS
  holdBill(): void {
    const heldBill = this.createHeldBill(this.heldBillName || `Bill ${new Date().toLocaleTimeString()}`);
    if (!heldBill) {
      this.snackBar.open("No items to hold", "Close", { duration: 2000 });
      return;
    }

    this.heldBills.unshift(heldBill);
    this.saveHeldBillsToStorage();
    this.snackBar.open(`Bill "${heldBill.name}" held successfully!`, 'Close', { duration: 2000 });
    this.clearCart();
    this.clearDraftFromStorage();
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
    this.selectedCustomerId = bill.selectedCustomerId || "";
    this.customerPhone = bill.customerPhone || "";
    this.customerAddress = bill.customerAddress || "";
    this.Display_items = JSON.parse(JSON.stringify(bill.items));
    this.billDiscount = bill.billDiscount || 0;
    this.paidAmount = bill.paidAmount || 0;
    this.walletUsedAmount = Number(bill.walletUsedAmount || 0);
    this.currentCustomerWalletBalance = Number(bill.currentCustomerWalletBalance || 0);
    this.paymentMethod = bill.paymentMethod || "CASH";
    this.useSplitPayment = Array.isArray(bill.splitPayments) && bill.splitPayments.length > 0;
    this.splitPayments = this.useSplitPayment ? JSON.parse(JSON.stringify(bill.splitPayments)) : [];

    this.rebuildSalesStateFromDisplayItems();
    this.onPaidAmountChange();
    this.saveDraftToStorage();
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
        this.heldBills = JSON.parse(saved).sort((a: any, b: any) => {
          const aTime = new Date(a?.heldAt || 0).getTime();
          const bTime = new Date(b?.heldAt || 0).getTime();
          return bTime - aTime;
        });
      }
    } catch (e) {
      console.error("Error loading held bills:", e);
    }
  }
  
  clearCart(): void {
    this.customerName = "";
    this.customerPhone = "";
    this.customerAddress = "";
    this.selectedCustomerId = "";
    this.currentCustomerWalletBalance = 0;
    this.walletUsedAmount = 0;
    this.Sales_added = {};
    this.final_Sales_data = {};
    this.Display_items = [];
    this.billDiscount = 0;
    this.paidAmount = 0;
    this.paymentMethod = "CASH";
    this.totalQuantity = 0;
    this.totalPurchasePrice = 0;
    this.useSplitPayment = false;
    this.splitPayments = [];
    this.clearDraftFromStorage();
  }

  onDraftFieldChange(): void {
    this.saveDraftToStorage();
  }

  setPaymentMethod(method: "CASH" | "UPI" | "CARD" | "BANK" | "ONLINE" | "CREDIT"): void {
    this.paymentMethod = method;
    if (!this.useSplitPayment) {
      this.paidAmount = Math.max(0, this.getNetTotal() - Number(this.walletUsedAmount || 0));
    }
    this.onPaidAmountChange();
    this.saveDraftToStorage();
  }

  getLineTotal(item: any): number {
    return Number(item?.quantity || 0) * Number(item?.purchasePrice || 0);
  }
  
  // SPLIT PAYMENT
  toggleSplitPayment(): void {
    this.useSplitPayment = !this.useSplitPayment;
    if (this.useSplitPayment) {
      const remaining = this.getRemainingForSplitRows();
      this.splitPayments = [
        { method: "CASH", amount: 0 },
        { method: "UPI", amount: remaining },
      ];
      this.paidAmount = remaining;
    } else {
      this.splitPayments = [];
      this.paidAmount = Math.max(0, this.getNetTotal() - Number(this.walletUsedAmount || 0));
    }
    this.normalizeSplitPayments();
    this.saveDraftToStorage();
  }
  
  addSplitPaymentRow(): void {
    this.splitPayments.push({ method: "CASH", amount: 0 });
    this.normalizeSplitPayments();
    this.saveDraftToStorage();
  }
  
  removeSplitPaymentRow(index: number): void {
    if (this.splitPayments.length > 1) {
      this.splitPayments.splice(index, 1);
      this.normalizeSplitPayments();
      this.saveDraftToStorage();
    }
  }
  
  getSplitPaymentTotal(): number {
    return Number(
      this.splitPayments.reduce((sum, sp) => sum + Number(sp.amount || 0), 0).toFixed(2),
    );
  }

  trackBySplitPaymentIndex(index: number): number {
    return index;
  }

  onSplitPaymentMethodChange(index: number, method: string): void {
    if (!this.splitPayments[index]) return;
    this.splitPayments[index].method = `${method || "CASH"}`.trim().toUpperCase();
    this.normalizeSplitPayments();
    this.saveDraftToStorage();
  }

  onSplitPaymentAmountChange(index: number): void {
    if (!this.splitPayments[index]) return;
    this.splitPayments[index].amount = Math.max(0, Number(this.splitPayments[index].amount || 0));
    this.normalizeSplitPayments();
    this.saveDraftToStorage();
  }

  private normalizeSplitPayments(): void {
    const net = this.getRemainingForSplitRows();
    const normalized = this.splitPayments.map((sp: any) => ({
      method: sp?.method || "CASH",
      amount: Math.max(0, Number(sp?.amount || 0)),
    }));
    let remaining = net;
    normalized.forEach((sp: any, index: number) => {
      if (index === normalized.length - 1) {
        this.splitPayments[index] = {
          ...this.splitPayments[index],
          method: sp.method,
          amount: Math.max(0, remaining),
        };
        return;
      }
      const safeAmount = Math.min(sp.amount, Math.max(0, remaining));
      remaining -= safeAmount;
      this.splitPayments[index] = {
        ...this.splitPayments[index],
        method: sp.method,
        amount: safeAmount,
      };
    });
    this.paidAmount = this.getSplitPaymentTotal();
  }

  getResolvedSalePaymentMethod(): "CASH" | "UPI" | "CARD" | "BANK" | "ONLINE" | "CREDIT" | "SPLIT" {
    if (!this.useSplitPayment) {
      return this.paymentMethod;
    }
    const uniqueMethods = Array.from(
      new Set(
        (this.splitPayments || [])
          .map((sp) => `${sp?.method || ""}`.trim().toUpperCase())
          .filter(Boolean),
      ),
    );
    if (uniqueMethods.length === 1) {
      return uniqueMethods[0] as any;
    }
    return "SPLIT";
  }

  getQrPayableAmount(): number {
    return Number(
      (this.splitPayments || [])
        .filter((sp) => ["UPI", "ONLINE"].includes(`${sp?.method || ""}`.trim().toUpperCase()))
        .reduce((sum, sp) => sum + Number(sp?.amount || 0), 0)
        .toFixed(2),
    );
  }

  getQrMerchantUpiId(): string {
    return `${this.activeShopDetails?.paymentSettings?.upiId || ""}`.trim().toLowerCase();
  }

  getQrMerchantName(): string {
    return `${this.activeShopDetails?.paymentSettings?.upiDisplayName || this.activeShopDetails?.name || "Shop Billing"}`.trim();
  }

  canShowQrPayment(): boolean {
    return this.useSplitPayment && this.getQrPayableAmount() > 0 && !!this.getQrMerchantUpiId();
  }

  getQrBlockedReason(): string {
    if (!this.useSplitPayment || this.getQrPayableAmount() <= 0) {
      return "";
    }
    if (!this.getQrMerchantUpiId()) {
      return "UPI QR ke liye Shop Settings me UPI ID save karni hogi.";
    }
    return "";
  }

  getUpiPaymentLink(): string {
    const upiId = encodeURIComponent(this.getQrMerchantUpiId());
    const merchantName = encodeURIComponent(this.getQrMerchantName());
    const amount = this.getQrPayableAmount().toFixed(2);
    const note = encodeURIComponent(`POS Bill ${this.customerName || "Walk-in"}`);
    return `upi://pay?pa=${upiId}&pn=${merchantName}&am=${amount}&cu=INR&tn=${note}`;
  }

  getQrImageUrl(): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(this.getUpiPaymentLink())}`;
  }
  
  getBillTotal(bill: any): number {
    if (!bill || !bill.items) return 0;
    return bill.items.reduce((sum: number, item: any) => sum + (item.quantity * item.purchasePrice), 0);
  }

  getHeldBillItemCount(bill: any): number {
    return Array.isArray(bill?.items)
      ? bill.items.reduce((sum: number, item: any) => sum + Number(item?.quantity || 0), 0)
      : 0;
  }

  get filteredHeldBills(): any[] {
    const allBills = Array.isArray(this.heldBills) ? [...this.heldBills] : [];
    const term = `${this.heldBillSearch || ""}`.trim().toLowerCase();
    const filtered = !term
      ? allBills
      : allBills.filter((bill: any) => {
          const haystack = [
            bill?.name,
            bill?.customerName,
            bill?.customerPhone,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(term);
        });

    return filtered.sort((a: any, b: any) => new Date(b?.heldAt || 0).getTime() - new Date(a?.heldAt || 0).getTime());
  }
  
  private resetForm(): void {
    this.clearCart();
    this.heldBillName = "";
  }

  private rebuildSalesStateFromDisplayItems(): void {
    const customerName = `${this.customerName || ""}`.trim() || "Walk-in";
    const items = Array.isArray(this.Display_items) ? this.Display_items : [];

    if (!items.length) {
      this.Sales_added = {};
      this.final_Sales_data = {};
      this.Display_items = [];
      this.calculateTotals();
      this.clearDraftFromStorage();
      return;
    }

    const clonedItems = JSON.parse(JSON.stringify(items));
    this.Sales_added = {
      [customerName]: {
        customerName,
        items: clonedItems,
        totalPurchasePrice: clonedItems.reduce((acc: number, it: any) => acc + Number(it?.quantity || 0) * Number(it?.purchasePrice || 0), 0),
        totalQuantity: clonedItems.reduce((acc: number, it: any) => acc + Number(it?.quantity || 0), 0),
      },
    };

    const itemTotal = clonedItems.reduce((acc: number, it: any) => acc + Number(it?.quantity || 0) * Number(it?.sellingPrice || it?.purchasePrice || 0), 0);
    this.final_Sales_data = {
      customerName,
      items: clonedItems,
      itemTotal,
      billDiscount: Number(this.billDiscount || 0),
      paidAmount: Number(this.paidAmount || 0),
      paymentMethod: this.paymentMethod || "CASH",
    };
    this.Display_items = clonedItems;
    this.calculateTotals();
    this.saveDraftToStorage();
    console.log("After rebuild - Display_items[0]:", this.Display_items[0]);
  }

  private shouldAutoHoldOnSaleError(error: any): boolean {
    const status = Number(error?.status ?? 0);
    return status === 0 || status >= 500;
  }

  private autoHoldCurrentBill(): boolean {
    const heldBill = this.createHeldBill(this.buildAutoHoldName(), true);
    if (!heldBill) {
      return false;
    }

    if (heldBill.autoHoldSignature && heldBill.autoHoldSignature === this.lastAutoHoldSignature) {
      return true;
    }

    const existingIndex = this.heldBills.findIndex((bill: any) => bill?.autoHoldSignature === heldBill.autoHoldSignature);
    if (existingIndex >= 0) {
      this.heldBills[existingIndex] = heldBill;
    } else {
      this.heldBills.unshift(heldBill);
    }

    this.lastAutoHoldSignature = heldBill.autoHoldSignature || "";
    this.saveHeldBillsToStorage();
    this.clearDraftFromStorage();
    return true;
  }

  private handleOnlineStatusChange(): void {
    if (navigator.onLine) {
      this.snackBar.open("Internet back aa gaya. Billing continue kar sakte ho.", "Close", { duration: 2200 });
      return;
    }

    const autoHeld = this.autoHoldCurrentBill();
    if (autoHeld) {
      this.snackBar.open("Internet chala gaya. Current bill auto Hold Bills me save ho gaya.", "Close", {
        duration: 3600,
      });
    }
  }

  private formatDateForApi(d: Date): string {
    const dt = new Date(d);
    const yyyy = dt.getFullYear();
    const mm = `${dt.getMonth() + 1}`.padStart(2, "0");
    const dd = `${dt.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  private buildAutoHoldName(): string {
    const baseName = `${this.customerName || "Walk-in"}`.trim() || "Walk-in";
    return `Auto Hold - ${baseName} - ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  private buildHoldSignature(items: any[]): string {
    const itemSignature = (items || [])
      .map((item: any) =>
        [
          item?.variationId || item?.variationSku || item?.itemName || "",
          Number(item?.quantity || 0),
          Number(item?.purchasePrice || 0),
        ].join(":"),
      )
      .sort()
      .join("|");
    const splitSignature = this.useSplitPayment
      ? (this.splitPayments || [])
          .map((row: any) => [`${row?.method || "CASH"}`, Number(row?.amount || 0)].join(":"))
          .join("|")
      : "";

    return [
      `${this.selectedCustomerId || ""}`,
      `${this.customerName || ""}`.trim() || "Walk-in",
      `${this.customerPhone || ""}`.trim(),
      Number(this.billDiscount || 0),
      Number(this.paidAmount || 0),
      Number(this.walletUsedAmount || 0),
      `${this.paymentMethod || "CASH"}`,
      `${this.useSplitPayment ? "split" : "single"}`,
      splitSignature,
      itemSignature,
    ].join("::");
  }

  private createHeldBill(name: string, autoHeld = false): any | null {
    if (!Array.isArray(this.Display_items) || this.Display_items.length === 0) {
      return null;
    }

    const items = JSON.parse(JSON.stringify(this.Display_items));
    const autoHoldSignature = this.buildHoldSignature(items);

    return {
      id: Date.now(),
      name,
      customerName: this.customerName || "Walk-in",
      selectedCustomerId: this.selectedCustomerId || "",
      customerPhone: this.customerPhone || "",
      customerAddress: this.customerAddress || "",
      items,
      billDiscount: this.billDiscount || 0,
      paidAmount: this.paidAmount || 0,
      walletUsedAmount: this.walletUsedAmount || 0,
      currentCustomerWalletBalance: this.currentCustomerWalletBalance || 0,
      paymentMethod: this.paymentMethod || "CASH",
      splitPayments: this.useSplitPayment ? JSON.parse(JSON.stringify(this.splitPayments)) : [],
      heldAt: new Date(),
      autoHeld,
      autoHoldSignature,
    };
  }

  private buildSalesDraft(): any | null {
    if (!Array.isArray(this.Display_items) || this.Display_items.length === 0) {
      return null;
    }

    return {
      customerName: this.customerName || "",
      customerPhone: this.customerPhone || "",
      customerAddress: this.customerAddress || "",
      selectedCustomerId: this.selectedCustomerId || "",
      currentCustomerWalletBalance: Number(this.currentCustomerWalletBalance || 0),
      walletUsedAmount: Number(this.walletUsedAmount || 0),
      items: JSON.parse(JSON.stringify(this.Display_items || [])),
      billDiscount: Number(this.billDiscount || 0),
      paidAmount: Number(this.paidAmount || 0),
      paymentMethod: this.paymentMethod || "CASH",
      useSplitPayment: !!this.useSplitPayment,
      splitPayments: this.useSplitPayment ? JSON.parse(JSON.stringify(this.splitPayments || [])) : [],
      heldBillName: this.heldBillName || "",
      savedAt: new Date().toISOString(),
    };
  }

  private saveDraftToStorage(): void {
    try {
      const draft = this.buildSalesDraft();
      if (!draft) {
        this.clearDraftFromStorage();
        return;
      }
      localStorage.setItem(this.salesDraftStorageKey, JSON.stringify(draft));
    } catch (e) {
      console.error("Error saving sales draft:", e);
    }
  }

  private restoreDraftFromStorage(): void {
    try {
      const savedDraft = localStorage.getItem(this.salesDraftStorageKey);
      if (!savedDraft) {
        return;
      }

      const draft = JSON.parse(savedDraft);
      if (!Array.isArray(draft?.items) || draft.items.length === 0) {
        this.clearDraftFromStorage();
        return;
      }

      const shouldRestore = window.confirm("Unsaved bill draft mila. Restore karein?");
      if (!shouldRestore) {
        return;
      }

      this.customerName = draft.customerName || "";
      this.customerPhone = draft.customerPhone || "";
      this.customerAddress = draft.customerAddress || "";
      this.selectedCustomerId = draft.selectedCustomerId || "";
      this.currentCustomerWalletBalance = Number(draft.currentCustomerWalletBalance || 0);
      this.walletUsedAmount = Number(draft.walletUsedAmount || 0);
      this.Display_items = JSON.parse(JSON.stringify(draft.items || []));
      this.billDiscount = Number(draft.billDiscount || 0);
      this.paidAmount = Number(draft.paidAmount || 0);
      this.paymentMethod = draft.paymentMethod || "CASH";
      this.useSplitPayment = !!draft.useSplitPayment;
      this.splitPayments = this.useSplitPayment ? JSON.parse(JSON.stringify(draft.splitPayments || [])) : [];
      this.heldBillName = draft.heldBillName || "";

      this.rebuildSalesStateFromDisplayItems();
      this.onPaidAmountChange();
      this.snackBar.open("Unsaved bill draft restored", "Close", { duration: 2600 });
    } catch (e) {
      console.error("Error restoring sales draft:", e);
      this.clearDraftFromStorage();
    }
  }

  private clearDraftFromStorage(): void {
    try {
      localStorage.removeItem(this.salesDraftStorageKey);
    } catch (e) {
      console.error("Error clearing sales draft:", e);
    }
  }

  private setupSuggestionStreams(): void {
    this.itemSearch$
      .pipe(
        debounceTime(240),
        distinctUntilChanged(),
        switchMap((term) => {
          this.itemSearchLoading = true;
          return this.item.searchProductsForPos(term);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response: any) => {
          this.suggestions = Array.isArray(response?.data) ? response.data : [];
          this.activeSuggestionIndex = this.suggestions.length ? 0 : -1;
          this.itemSearchLoading = false;
        },
        error: () => {
          this.suggestions = [];
          this.activeSuggestionIndex = -1;
          this.itemSearchLoading = false;
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
            return;
          }

          this.cus_full_suggestions = [];
        },
        error: () => {
          this.cus_full_suggestions = [];
        },
      });
  }
}
