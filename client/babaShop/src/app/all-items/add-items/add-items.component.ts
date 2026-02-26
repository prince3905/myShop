import { Component, OnInit } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { DistributorService } from "app/shared/services/distributor.service";
import { ProductService } from "app/shared/services/product.service";
import { Router } from "@angular/router";
import { forkJoin } from "rxjs";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Inject } from "@angular/core";

@Component({
  selector: "add-items",
  templateUrl: "./add-items.component.html",
  styleUrls: ["./add-items.component.css"],
})
export class AddItemsComponent implements OnInit {
  product: any = {
    name: "",
    category: "",
    brand: "",
    description: "",
  };
  categories: any[] = [];
  brands: any[] = [];

  isLoading = false;

  showConfirmationDialog = false;
  isEditMode: boolean = false;

  constructor(
    private category: CategoryService,
    private brand: BrandService,
    private Product: ProductService,
    private snackBar: MatSnackBar,
    private distributor: DistributorService,
    public dialogRef: MatDialogRef<AddItemsComponent>,
    private dialog: MatDialog,
    private router: Router,
    private productService: ProductService,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  ngOnInit(): void {
    this.loadDropdownData();
    if (this.data?.product) {
      this.product = {
        name: this.data.product.name,
        category: this.data.product.category?._id,
        brand: this.data.product.brand?._id,
        description: this.data.product.description,
      };

      this.isEditMode = true;
    }
  }

  loadDropdownData(): void {
    this.category.getAllCategories().subscribe(
      (res: any) => {
        this.categories = res.data || [];
        console.log("Loaded Categories:", this.categories);
      },
      (err) => console.error("Category Load Error:", err),
    );

    this.brand.getAllBrands().subscribe(
      (res: any) => {
        this.brands = res.data || [];
        console.log("Loaded Brands:", this.brands);
      },
      (err) => console.error("Brand Load Error:", err),
    );
  }

  saveProduct() {

  if (!this.product.name || !this.product.category || !this.product.brand) {
    this.snackBar.open("⚠ Please fill all required fields", "Close", {
      duration: 2500,
      panelClass: ['snackbar-error']
    });
    return;
  }

  this.isLoading = true;

  if (this.isEditMode) {

    this.productService
      .updateProduct(this.data.product._id, this.product)
      .subscribe({

        next: () => {
          this.isLoading = false;

          this.snackBar.open("✅ Product updated successfully!", "Close", {
            duration: 3000,
            panelClass: ['snackbar-success']
          });

          this.dialogRef.close(true);
        },

        error: (err) => {
          console.error(err);
          this.isLoading = false;

          this.snackBar.open("❌ Failed to update product!", "Close", {
            duration: 3000,
            panelClass: ['snackbar-error']
          });
        }

      });

  } else {

    this.productService
      .addProduct(this.product)
      .subscribe({

        next: () => {
          this.isLoading = false;

          this.snackBar.open("✅ Product added successfully!", "Close", {
            duration: 3000,
            panelClass: ['snackbar-success']
          });

          this.dialogRef.close(true);
        },

        error: (err) => {
          console.error(err);
          this.isLoading = false;

          this.snackBar.open("❌ Failed to add product!", "Close", {
            duration: 3000,
            panelClass: ['snackbar-error']
          });
        }

      });
  }
}
}
