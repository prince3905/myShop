import { Component, OnInit } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
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
  selectedCategory: string = "";
  selectedBrand: string = "";
  name: string = "";
  color: string = "";
  model: string = "";
  quantity: number;
  size: number;
  p_price: number;
  s_price: number;
  description: string = "";

  constructor(
    private category: CategoryService,
    private brand: BrandService,
    private item: ItemService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<any>,

  ) {}

  ngOnInit(): void {
    this.getCategoryAndBrand();
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
        // Handle error here (e.g., show error message to the user)
      }
    );
  }

  onSubmit(): void {
    // console.log(this.selectedCategory)
    // console.log(this.selectedBrand)
    const formData = {
      name: this.name,
      category: this.selectedCategory,
      brand: this.selectedBrand,
      color: this.color,
      model: this.model,
      quantity: this.quantity,
      size: this.size,
      p_price: this.p_price,
      s_price: this.s_price,
      description: this.description,
    };
    console.log(formData);
    this.item.addItem(formData).subscribe(
      (response:any) => {
        console.log(response);
        this.snackBar.open( response.message, 'Close', {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });
        this.dialogRef.close();
      },
      (error:any) => {
         console.error('Error adding item:', error);
      this.snackBar.open('Failed to add item.', 'Close', {
        duration: 5000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
      this.dialogRef.close();
      }
    );
  }
}
