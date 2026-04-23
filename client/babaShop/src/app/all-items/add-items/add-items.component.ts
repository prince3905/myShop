import { Component, OnInit, Optional } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { DistributorService } from "app/shared/services/distributor.service";
import { ProductService } from "app/shared/services/product.service";
import { ActivatedRoute, Router } from "@angular/router";
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
    icon: "chair",
  };
  categories: any[] = [];
  brands: any[] = [];
  filteredBrands: any[] = [];

  isLoading = false;
  private returnTo: string | null = null;

  showConfirmationDialog = false;
  isEditMode: boolean = false;
  generating = false;

  generateDescription(): void {
    if (!this.product.name?.trim()) {
      this.snackBar.open("Please enter product name first", "Close", { duration: 2500 });
      return;
    }

    this.generating = true;
    const adj = ["premium", "high-quality", "durable", "reliable", "best-in-class"];
    const randomAdj = adj[Math.floor(Math.random() * adj.length)];
    const generated = randomAdj.charAt(0).toUpperCase() + randomAdj.slice(1) + " " + this.product.name.trim() + " with excellent build quality. Perfect for everyday use.";
    
    if (this.product.description) {
      this.product.description = this.product.description + " " + generated;
    } else {
      this.product.description = generated;
    }
    this.generating = false;
    this.snackBar.open("Description added", "Close", { duration: 2000 });
  }

  constructor(
    private category: CategoryService,
    private brand: BrandService,
    private Product: ProductService,
    private snackBar: MatSnackBar,
    private distributor: DistributorService,
    @Optional() public dialogRef: MatDialogRef<AddItemsComponent>,
    private dialog: MatDialog,
    private router: Router,
    private route: ActivatedRoute,
    private productService: ProductService,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  ngOnInit(): void {
    this.loadDropdownData();
    this.returnTo = this.route.snapshot.queryParamMap.get("returnTo");
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
        this.updateFilteredBrands();
      },
      (err) => console.error("Category Load Error:", err),
    );

    this.brand.getAllBrands().subscribe(
      (res: any) => {
        this.brands = res.data || [];
        this.updateFilteredBrands();
      },
      (err) => console.error("Brand Load Error:", err),
    );
  }

  onCategoryChange(): void {
    this.updateFilteredBrands();
  }

  private updateFilteredBrands(): void {
    const selectedCategory = this.categories.find(
      (category) => `${category?._id || ""}` === `${this.product.category || ""}`,
    );

    const categoryBrandIds = Array.isArray(selectedCategory?.brands)
      ? selectedCategory.brands.map((brand: any) =>
          typeof brand === "string" ? brand : `${brand?._id || ""}`,
        )
      : [];

    this.filteredBrands = categoryBrandIds.length
      ? this.brands.filter((brand) => categoryBrandIds.includes(`${brand?._id || ""}`))
      : this.brands;

    const selectedBrandStillValid = this.filteredBrands.some(
      (brand) => `${brand?._id || ""}` === `${this.product.brand || ""}`,
    );

    if (this.product.brand && !selectedBrandStillValid) {
      this.product.brand = "";
    }
  }

  cancel(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
      return;
    }

    this.router.navigate([this.returnTo || "/item-list"]);
  }

  saveProduct() {
    if (!this.product.name || !this.product.category || !this.product.brand) {
      this.snackBar.open("Please fill all required fields", "Close", {
        duration: 2500,
        panelClass: ["snackbar-error"]
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

            this.snackBar.open("Product updated successfully", "Close", {
              duration: 3000,
              panelClass: ["snackbar-success"]
            });

            if (this.dialogRef) {
              this.dialogRef.close(true);
              return;
            }

            this.router.navigate([this.returnTo || "/item-list"], {
              queryParams: this.returnTo ? { refresh: Date.now(), productName: this.product.name } : undefined,
            });
          },
          error: () => {
            this.isLoading = false;

            this.snackBar.open("Failed to update product", "Close", {
              duration: 3000,
              panelClass: ["snackbar-error"]
            });
          }
        });
    } else {
      this.productService
        .addProduct(this.product)
        .subscribe({
          next: (res: any) => {
            this.isLoading = false;
            const createdProductId = res?.data?._id || res?._id || null;

            this.snackBar.open("Product added successfully", "Close", {
              duration: 3000,
              panelClass: ["snackbar-success"]
            });

            if (this.dialogRef) {
              this.dialogRef.close({
                created: true,
                productId: createdProductId,
              });
              return;
            }

            if (createdProductId) {
              this.router.navigate(["/add-detail", createdProductId]);
              return;
            }

            this.router.navigate([this.returnTo || "/item-list"], {
              queryParams: this.returnTo ? { refresh: Date.now(), productName: this.product.name } : undefined,
            });
          },
          error: () => {
            this.isLoading = false;

            this.snackBar.open("Failed to add product", "Close", {
              duration: 3000,
              panelClass: ["snackbar-error"]
            });
          }
        });
    }
  }
}
