import { Component, OnInit } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { DistributorService } from "app/shared/services/distributor.service";
import { ItemService } from "app/shared/services/item.service";
import { response } from "express";
import { forkJoin } from "rxjs";

@Component({
  selector: "add-items",
  templateUrl: "./add-items.component.html",
  styleUrls: ["./add-items.component.css"],
})
export class AddItemsComponent implements OnInit {
  Category: any = [];
  Brands: any = [];
  Distributors: any = [];
  selectedCategory: string = "";
  selectedBrand: string = "";
  availableBrands: any[] = [];
  selectedDistributor: string = "";
  name: string = "";
  description: string = "";

  showConfirmationDialog = false;

  // Initialize the product object with empty arrays for models and variations
  product: any = {
    name: this.name,
    category: this.selectedCategory,
    brand: this.selectedBrand,
    distributor: this.selectedDistributor,
    models: [],
  };

  model: any = {
    model: "",
    color: "",
    size: "",
    description: "",
    variations: [],
  };

  variation: any = {
    p_price: "",
    s_price: "",
    quantity: "",
  };

  constructor(
    private category: CategoryService,
    private brand: BrandService,
    private item: ItemService,
    private snackBar: MatSnackBar,
    private distributor: DistributorService,
    public dialogRef: MatDialogRef<any>,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.getCategoryAndBrand();
    this.category
      .getCategoryOnBrands("651d7b0aaaa62a812f29661f")
      .subscribe((brands: any[]) => {
        console.log(brands);
      });
  }

 

  getCategoryAndBrand(): void {
    forkJoin({
      categories: this.category.getCategory(),
      // brands: this.brand.getBrand(),
      distributors: this.distributor.getDistributor(null),
    }).subscribe(
      (response: any) => {
        this.Category = response.categories;
        // this.Brands = response.brands;
        this.Distributors = response.distributors.distributors;
        console.log("All Categories:", this.Category);
        // console.log("All Brands:", this.Brands);
        console.log("All Distributors:", this.Distributors);
      },
      (error) => {
        console.error("Error retrieving data:", error);
      }
    );
  }

  addModel(): void {
    // Create a new model and reset the model form fields
    const newModel = { ...this.model };
    this.product.models.push(newModel);
    this.resetModelFields();
    // console.log('Add Model',newModel);
    // console.log('Item object:', this.product);
  }

  addVariation(model: any): void {
    // Create a new variation and reset the variation form fields
    const newVariation = { ...this.variation, soldOut: false };
    model.variations.push(newVariation);
    this.resetVariationFields();
    // console.log('Add Variation', model);
    // console.log('newVariation', newVariation);
    // console.log('Item object:', this.product);
  }

  resetModelFields(): void {
    this.model = {
      model: "",
      color: "",
      size: "",
      description: "",
      variations: [],
    };
  }

  resetVariationFields(): void {
    this.variation = {
      p_price: "",
      s_price: "",
      quantity: "",
      soldOut: false,
    };
  }

  onCategoryChange(event: any) {
    const selectedCategoryId = event.value;
    console.log("Selected Category ID:", selectedCategoryId);
    this.category
      .getCategoryOnBrands(selectedCategoryId)
      .subscribe((response: any) => {
        console.log(response);
        this.Brands = response.brands;
      });
  }

  onSubmit(): void {
    console.log(this.product);
    this.showConfirmationDialog = true;
  }

  sendDataToDatabase(): void {
    this.item.addItem(this.product).subscribe(
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
        console.error("Error adding item:", error);
        this.snackBar.open("Failed to add item.", "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
        this.dialogRef.close();
      }
    );
    this.showConfirmationDialog = false;
  }

  cancelSendToDatabase(): void {
    this.showConfirmationDialog = false;
  }
}
