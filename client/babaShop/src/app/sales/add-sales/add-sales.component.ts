import { Component, OnInit } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { ItemService } from "app/shared/services/item.service";
import { SalesService } from "app/shared/services/sales.service";
import { StocksService } from "app/shared/services/stocks.service";
import { forkJoin } from "rxjs";

@Component({
  selector: "add-sales",
  templateUrl: "./add-sales.component.html",
  styleUrls: ["./add-sales.component.css"],
})
export class AddSalesComponent implements OnInit {
  Category: any = [];
  Brands: any = [];
  selectedCategory: string = "";
  selectedBrand: string = "";
  itemName: string = "";
  customerName: string = "";
  model: string = "";
  quantity: number;
  size: string;
  purchasePrice: number;
  description: string = "";
  Sales_added: any = {};
  final_Sales_data: any = {};
  Display_items: any = {};
  totalPurchasePrice: number = null;
  totalQuantity: number = null;

  suggestions: string[] = [];
  cus_suggestions: string[] = [];
  size_suggestions: string[] = [];
  model_suggestions: string[] = [];

  constructor(
    private category: CategoryService,
    private brand: BrandService,
    private item: ItemService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<any>,
    private Sales: SalesService,
    private stock: StocksService
  ) {}

  ngOnInit(): void {
    this.getCategoryAndBrand();
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

  getCategoryAndBrand(): void {
    forkJoin({
      categories: this.category.getCategory(),
      brands: this.brand.getBrand(),
    }).subscribe(
      (response) => {
        this.Category = response.categories;
        this.Brands = response.brands;
        console.log("All Categories:", this.Category);
        console.log("All Brands:", this.Brands);
      },
      (error) => {
        console.error("Error retrieving data:", error);
      }
    );
  }

  async onSubmit(): Promise<void> {
    try {
      const stockInfo: any = await this.stock.getStocks(null).toPromise();
      console.log(stockInfo);
      const selectedItemKey = stockInfo.stockReport.find(
        (stockItem: any) => stockItem.itemName === this.itemName
      );
      console.log(selectedItemKey);

      if (!selectedItemKey) {
        console.warn("Selected item not found in stock information.");
        this.snackBar.open(
          "Selected item not found in stock information..",
          "Close",
          {
            duration: 5000,
            horizontalPosition: "center",
            verticalPosition: "top",
          }
        );
        return;
      }

      if (selectedItemKey.remainingQuantity <= 0) {
        console.warn("Requested quantity is greater than available stock.");
        this.snackBar.open(
          "Requested quantity is greater than available stock.",
          "Close",
          {
            duration: 5000,
            horizontalPosition: "center",
            verticalPosition: "top",
          }
        );
        return;
      }

      if (this.quantity > selectedItemKey.remainingQuantity) {
        console.warn("Requested quantity is greater than available stock.");
        this.snackBar.open(
          "Requested quantity is greater than available stock.",
          "Close",
          {
            duration: 5000,
            horizontalPosition: "center",
            verticalPosition: "top",
          }
        );
        return;
      }
    } catch (error) {
      console.error("Error fetching stock information:", error);
      // Handle the error
    }

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
      });
      customerSales.totalPurchasePrice += this.quantity * this.purchasePrice;
      customerSales.totalQuantity += this.quantity;
    }
    this.final_Sales_data = {
      customerName: this.customerName,
      items: customerSales.items,
    };

    // Calculate total purchase price and total quantity
    this.totalPurchasePrice = customerSales.totalPurchasePrice;
    this.totalQuantity = customerSales.totalQuantity;
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
    console.log("Submitting Sales Data:", this.final_Sales_data);
    this.Sales.addSales(this.final_Sales_data).subscribe(
      (response: any) => {
        console.log(response);
        this.snackBar.open(response.message, "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
        this.dialogRef.close();
      },
      (error: any) => {
        console.error("Error adding Sales item:", error);
        this.snackBar.open("Failed to add Sales item.", "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
        this.dialogRef.close();
      }
    );
  }
}
