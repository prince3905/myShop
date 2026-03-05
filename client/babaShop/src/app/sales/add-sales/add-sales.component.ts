import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { ItemService } from "app/shared/services/item.service";
import { SalesService } from "app/shared/services/sales.service";
import { StocksService } from "app/shared/services/stocks.service";
import { VariationService } from "app/shared/services/variation.service";
import { forkJoin } from "rxjs";

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
  Sales_added: any = {};
  final_Sales_data: any = {};
  Display_items: any = {};
  totalPurchasePrice: number = null;
  totalQuantity: number = null;

  suggestions: string[] = [];
  cus_suggestions: string[] = [];
  size_suggestions: string[] = [];
  model_suggestions: string[] = [];

  selectedModel: string = '';
  selectedVariation: string = '';
  selectedModelVariations: any[] = [];
  selectedVariationId: string = "";
  selectedProductId: string = "";
  selectedModelId: string = "";
  selectedVariationSku: string = "";
  scannedBarcode: string = "";
  private scanDebounceTimer: any = null;
  private barcodeLookupLoading = false;
  @ViewChild("barcodeInputRef") barcodeInputRef?: ElementRef<HTMLInputElement>;

  constructor(
    private category: CategoryService,
    private brand: BrandService,
    private item: ItemService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<any>,
    private Sales: SalesService,
    private stock: StocksService,
    private variationService: VariationService,
  ) {}

  ngOnInit(): void {
    // this.getCategoryAndBrand();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.focusBarcodeInput(), 120);
  }

  ngOnDestroy(): void {
    if (this.scanDebounceTimer) {
      clearTimeout(this.scanDebounceTimer);
      this.scanDebounceTimer = null;
    }
  }

  fetchSuggestions(): void {
    this.item.getItemSuggestion(this.itemName).subscribe(
      (suggestions: any[]) => {
        this.suggestions = suggestions;
        console.log(this.suggestions);
      },
      (error: any) => {
        console.error("Error fetching suggestions:", error);
      }
    );
  }

  selectSuggestion(suggestion: string): void {
    console.log(suggestion)
    this.ProductsByName(suggestion)
    this.itemName = suggestion;
    this.suggestions = [];
  }


  fetchCusSuggestions(): void {
    this.Sales.getCustomerSuggestion(this.customerName).subscribe(
      (suggestions: any[]) => {
        this.cus_suggestions = suggestions;
        console.log(this.cus_suggestions);
      },
      (error: any) => {
        console.error("Error fetching suggestions:", error);
      }
    );
  }

  selectCusSuggestion(suggestion: string): void {
    this.customerName = suggestion;
    this.cus_suggestions = [];
  }

  SizeSuggestions(): void {
    this.item.getSizeSuggestion(this.size).subscribe(
      (suggestions: any[]) => {
        this.size_suggestions = suggestions;
        console.log(this.size_suggestions);
      },
      (error: any) => {
        console.error("Error fetching suggestions:", error);
      }
    );
  }

  selectSizeSuggestion(suggestion: string): void {
    this.size = suggestion;
    this.size_suggestions = [];
  }

  updateSelectedModelVariations(): void {
    const selectedModelObject = this.selectedItemModels.find((model) => model.model === this.selectedModel);
    if (selectedModelObject) {
      this.selectedModelVariations = selectedModelObject.variations;
      this.model = this.selectedModel;
      console.log("Selected Model:", this.model);
      console.log(this.selectedModelVariations)
    } else {
      this.selectedModelVariations = [];
    }
  }
  

  onVariationChange(selectedVariation: string): void {
    const selectedVariationObject = this.selectedModelVariations.find(
      (variation) => variation.orderNumber === selectedVariation
    );
  
    if (selectedVariationObject) {
      console.log(selectedVariationObject)
      this.size = selectedVariationObject.size;
      this.color = selectedVariationObject.color;
      this.selectedVariationId = selectedVariationObject._id || "";
      this.selectedVariationSku = selectedVariationObject.sku || selectedVariationObject.orderNumber || "";
      this.selectedProductId = selectedVariationObject.product?._id || selectedVariationObject.product || "";
      this.selectedModelId =
        selectedVariationObject.model?._id || selectedVariationObject.model || this.selectedModelId;
      console.log("Selected Variation: ", selectedVariation);
      console.log("Selected Size: ", this.size);
      console.log("Selected Color: ", this.color);
    } else {
      this.size = ''; // Clear the size field
      this.color = ''; // Clear the color field
      this.selectedVariationId = "";
      this.selectedVariationSku = "";
      this.selectedProductId = "";
      this.selectedModelId = "";
    }
  }

  fetchModSuggestions(): void {
    this.item.getModelSuggestion(this.model).subscribe(
      (suggestions: any[]) => {
        this.model_suggestions = suggestions;
        console.log(this.model_suggestions);
      },
      (error: any) => {
        console.error("Error fetching suggestions:", error);
      }
    );
  }

  selectModSuggestion(suggestion: string): void {
    this.model = suggestion;
    this.model_suggestions = [];
  }

  onBarcodeScan(): void {
    const code = (this.scannedBarcode || "").trim();
    if (!code || this.barcodeLookupLoading) return;

    this.barcodeLookupLoading = true;

    this.variationService.getVariations({ barcode: code, limit: 1, skip: 0 }).subscribe({
      next: (res: any) => {
        const row = Array.isArray(res?.data) ? res.data[0] : null;
        if (!row) {
          this.snackBar.open("No variation found for this barcode", "Close", {
            duration: 2500,
          });
          this.barcodeLookupLoading = false;
          return;
        }

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
        if (!this.quantity || this.quantity < 1) {
          this.quantity = 1;
        }

        this.snackBar.open(`Loaded: ${row?.sku || code}`, "Close", {
          duration: 1800,
        });
        this.barcodeLookupLoading = false;
        this.scannedBarcode = "";
        this.focusBarcodeInput();
      },
      error: () => {
        this.snackBar.open("Barcode search failed", "Close", { duration: 2500 });
        this.barcodeLookupLoading = false;
        this.focusBarcodeInput();
      },
    });
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

  // getCategoryAndBrand(): void {
  //   forkJoin({
  //     categories: this.category.getCategory(),
  //   }).subscribe(
  //     (response: any) => {
  //       this.Category = response.categories;
  //       // this.Brands = response.brands;
  //       console.log("All Categories:", this.Category);
  //       // console.log("All Brands:", this.Brands);
  //     },
  //     (error) => {
  //       console.error("Error retrieving data:", error);
  //     }
  //   );
  // }

  ProductsByName(data): void {
    console.log(data)
    this.item.getProductsByName(data).subscribe(
      (response: any) => {
        this.selectedItemModels = response[0].models;
        console.log(this.selectedItemModels)
      },
      (error) => console.error("Error retrieving items:", error)
    );
  }
  

  onModelChange(item: any): void {
    // Find the selected model object based on the selectedModel value
    const selectedModelObject = item.models.find((model) => model.model === item.selectedModel);
    if (selectedModelObject) {
      // Update the size property with the size of the selected model
      item.size = selectedModelObject.size;
      item.selectedModelVariations = selectedModelObject.variations;
    } else {
      // Handle the case when no model is selected (optional)
      item.size = '';
      item.selectedModelVariations = [];
    }
  
    // Update selectedModelVariations with the variations for the selected model
    item.selectedModelVariations = selectedModelObject ? selectedModelObject.variations : [];

    console.log("Selected Model:", item.selectedModel);
    console.log("Selected Model Variations:", item.selectedModelVariations);
  }

  // onCategoryChange(event: any) {
  //   const selectedCategoryId = event.value;
  //   console.log("Selected Category ID:", selectedCategoryId);
  //   this.category
  //     .getCategoryOnBrands(selectedCategoryId)
  //     .subscribe((response: any) => {
  //       console.log(response);
  //       this.Brands = response.brands;
  //     });
  // }

            async onSubmit(): Promise<void> {
                  // try {
                  //   const stockInfo: any = await this.stock.getStocks(null).toPromise();
                  //   console.log(stockInfo);
                  //   const selectedItemKey = stockInfo.stockReport.find(
                  //     (stockItem: any) => stockItem.itemName === this.itemName
                  //   );
                  //   console.log(selectedItemKey);

                  //   if (!selectedItemKey) {
                  //     console.warn("Selected item not found in stock information.");
                  //     this.snackBar.open(
                  //       "Selected item not found in stock information..",
                  //       "Close",
                  //       {
                  //         duration: 5000,
                  //         horizontalPosition: "center",
                  //         verticalPosition: "top",
                  //       }
                  //     );
                  //     return;
                  //   }

                  //   if (selectedItemKey.remainingQuantity <= 0) {
                  //     console.warn("Requested quantity is greater than available stock.");
                  //     this.snackBar.open(
                  //       "Requested quantity is greater than available stock.",
                  //       "Close",
                  //       {
                  //         duration: 5000,
                  //         horizontalPosition: "center",
                  //         verticalPosition: "top",
                  //       }
                  //     );
                  //     return;
                  //   }

                  //   if (this.quantity > selectedItemKey.remainingQuantity) {
                  //     console.warn("Requested quantity is greater than available stock.");
                  //     this.snackBar.open(
                  //       "Requested quantity is greater than available stock.",
                  //       "Close",
                  //       {
                  //         duration: 5000,
                  //         horizontalPosition: "center",
                  //         verticalPosition: "top",
                  //       }
                  //     );
                  //     return;
                  //   }
                  // } catch (error) {
                  //   console.error("Error fetching stock information:", error);
                  // }

              let customerSales = this.Sales_added[this.customerName];

                  if (!customerSales) {
                    customerSales = {
                      customerName: this.customerName,
                      items: [
                        {
                          itemName: this.itemName,
                          category: this.selectedCategory,
                          brand: this.selectedBrand,
                          quantity: this.quantity,
                          purchasePrice: this.purchasePrice,
                          model: this.model,
                          size: this.size,
                          variations: this.selectedVariationSku || this.variations,
                          variationId: this.selectedVariationId || null,
                          variationSku: this.selectedVariationSku || this.variations || null,
                          productId: this.selectedProductId || null,
                          modelId: this.selectedModelId || null,
                        },
                      ],
                      totalPurchasePrice: this.quantity * this.purchasePrice,
                      totalQuantity: this.quantity,
                    };

                    this.Sales_added[this.customerName] = customerSales;
                  } else {
                    customerSales.items.push({
                      itemName: this.itemName,
                      category: this.selectedCategory,
                      brand: this.selectedBrand,
                      quantity: this.quantity,
                      purchasePrice: this.purchasePrice,
                      model: this.model,
                      size: this.size,
                      variations: this.selectedVariationSku || this.variations,
                      variationId: this.selectedVariationId || null,
                      variationSku: this.selectedVariationSku || this.variations || null,
                      productId: this.selectedProductId || null,
                      modelId: this.selectedModelId || null,
                    });
                    customerSales.totalPurchasePrice += this.quantity * this.purchasePrice;
                    customerSales.totalQuantity += this.quantity;
                  }
                  this.final_Sales_data = {
                    customerName: this.customerName,
                    items: customerSales.items,
                    billDiscount: Number(this.billDiscount || 0),
                    paidAmount: Number(this.paidAmount || 0),
                    paymentMethod: this.paymentMethod || "CASH",
                  };

              // this.totalPurchasePrice = customerSales.totalPurchasePrice;
              // this.totalQuantity = customerSales.totalQuantity;
              this.Display_items = this.final_Sales_data.items;
              this.calculateTotals();

              console.log("Sales Data to be Submitted:", this.final_Sales_data);
              console.log("Display_items", this.Display_items);
              console.log("Total Purchase Price:", this.totalPurchasePrice);
              console.log("Total Quantity:", this.totalQuantity);
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





            onSales() {
              //   const data ={
              //     "customerName": "John Doe",
              //     "items": [
              //         {
              //             "itemName": "Paints",
              //             "category": "Category 1",
              //             "brand": "Brand 1",
              //             "quantity": 5,
              //             "purchasePrice": 100,
              //             "model": "Model 123",
              //             "size": "Large"
              //         },
              //         {
              //             "itemName": "Jeans",
              //             "category": "Category 2",
              //             "brand": "Brand 2",
              //             "quantity": 10,
              //             "purchasePrice": 100,
              //             "model": "Model 456",
              //             "size": "Medium"
              //         }

              //     ]
              // }
              if (!Array.isArray(this.Display_items) || this.Display_items.length === 0) {
                this.snackBar.open("Add at least one item before save", "Close", {
                  duration: 2500,
                });
                return;
              }

              const net = this.getNetTotal();
              if (Number(this.paidAmount || 0) > net) {
                this.snackBar.open("Paid amount cannot be greater than net total", "Close", {
                  duration: 2600,
                });
                return;
              }

              this.final_Sales_data = {
                customerName: this.customerName || "Walk-in",
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
                paidAmount: Number(this.paidAmount || 0),
                paymentMethod: this.paymentMethod || "CASH",
              };

              console.log("Submitting Sales Data:", this.final_Sales_data);
              this.Sales.addSales(this.final_Sales_data).subscribe(
                (response: any) => {
                  this.snackBar.open(response?.message || "Sale saved", "Close", {
                    duration: 3200,
                    horizontalPosition: "center",
                    verticalPosition: "bottom",
                  });
                  this.dialogRef.close(true);
                },
                (error: any) => {
                  console.error("Error adding Sales item:", error);
                  this.snackBar.open(error?.error?.message || "Failed to add sales item", "Close", {
                    duration: 4000,
                    horizontalPosition: "center",
                    verticalPosition: "bottom",
                  });
                }
              );
            }






}
