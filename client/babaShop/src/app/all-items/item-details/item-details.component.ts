import { Component, OnInit } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ActivatedRoute, Router } from "@angular/router";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { ItemService } from "app/shared/services/item.service";
import { response } from "express";
import { forkJoin } from "rxjs";

@Component({
  selector: "item-details",
  templateUrl: "./item-details.component.html",
  styleUrls: ["./item-details.component.css"],
})
export class ItemDetailsComponent implements OnInit {
  selectedCategory: string = "";
  selectedBrand: string = "";
  sendCategory: string = "";
  sendBrand: string = "";
  name: String = "";
  color: String = "";
  model: any;
  quantity: any;
  size: String = "";
  p_price: number;
  s_price: number;
  description: String = "";
  itemId: string;
  item: any = [];
  Categories: any = [];
  Brands: any = [];
  isEditing: boolean = false;

  onSubmit() {}

  handleEdit() {
    this.getCategoryAndBrand();
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.name = this.item?.name;
      // this.Category = this.item?.selectedCategory;
      // this.Brand = this.item?.selectedCategory;
      this.color = this.item?.color;
      this.model = this.item?.model;
      this.quantity = this.item?.quantity;
      this.size = this.item?.size;
      this.p_price = this.item?.p_price;
      this.s_price = this.item?.s_price;
      this.description = this.item?.description;
    }
  }

  constructor(
    private route: ActivatedRoute,
    private itemS: ItemService,
    private category: CategoryService,
    private brand: BrandService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.itemId = params.get("id");
      console.log(this.itemId);
      this.fetchItemDetails(this.itemId);
    });
  }

  getCategoryAndBrand(): void {
    forkJoin({
      categories: this.category.getCategory(),
      brands: this.brand.getBrand(),
    }).subscribe(
      (response) => {
        this.Categories = response.categories;
        this.Brands = response.brands;
        // console.log("All Categories:", this.Categories);
        // console.log("All Brands:", this.Brands);
      },
      (error) => {
        console.error("Error retrieving data:", error);
        // Handle error here (e.g., show error message to the user)
      }
    );
  }

  fetchItemDetails(itemId: string) {
    console.log("item id here", itemId);
    this.itemS.getItemDetails(itemId).subscribe(
      (response) => {
        this.item = response;
        console.log("All items Details", response);
      },

      (error) => {
        console.error("Error retrieving items:", error);
        // Handle error here (e.g., show error message to the user)
      }
    );
  }

  saveChanges() {
    const formData = {
      id: this.itemId,
      name: this.name,
      sendBrand: this.selectedBrand,
      sendCategory: this.selectedCategory,
      // category: this.Category,
      // brand: this.Brand,
      color: this.color,
      model: this.model,
      quantity: this.quantity,
      size: this.size,
      p_price: this.p_price,
      s_price: this.s_price,
      description: this.description,
    };
    console.log(formData);
    this.itemS.updateItem(formData).subscribe(
      (response: any) => {
        console.log(response);
        this.isEditing = false;
        this.snackBar.open(response.message, "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
        this.router.navigate(["/item-list"]);
      },
      (error: any) => {
        console.error("Error adding item:", error);
        this.snackBar.open("Failed to add item.", "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
      }
    );
    this.router.navigate(["/item-list"]);
  }


  deleteItem(): void {
    this.itemS.deleteItem(this.itemId).subscribe(
      (response: any) => {
        console.log(response);
        this.snackBar.open(response.message, "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
        this.router.navigate(["/item-list"]);
      },
      (error: any) => {
        console.error(error.message, error);
        this.snackBar.open("Failed to delete item.", "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
      }
    );
    this.router.navigate(["/item-list"]);

  }
}
