import { ComponentsModule } from "./../../components/components.module";
import { Component, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";

import { AddItemsComponent } from "../add-items/add-items.component";
import { ItemService } from "app/shared/services/item.service";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { FormControl, Validators } from "@angular/forms";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { Subject, forkJoin } from "rxjs";
import { AddCategoryComponent } from "../add-category/add-category.component";
import { AddBrandComponent } from "../add-brand/add-brand.component";

@Component({
  selector: "items-list",
  templateUrl: "./items-list.component.html",
  styleUrls: ["./items-list.component.css"],
})
export class ItemsListComponent implements OnInit {
  panelOpenState = false;
  Category: any = [];
  Brands: any = [];
  items: any = [];
  name: string;
  category: string;
  brand: string;
  itemName: string = "";
  startDate: Date;
  endDate: Date;
  searchInput: string;
  searchInputSubject = new Subject<string>();

  selectedOption: string;
  selectedCategory: string;
  selectedBrand: string;

  searchParams = {};
  suggestions: string[] = [];

  constructor(
    public dialog: MatDialog,
    private item: ItemService,
    private router: Router,
    private Router: ActivatedRoute,
    private categoryS: CategoryService,
    private brandS: BrandService
  ) {}

  ngOnInit(): void {
    this.getAllItems("null");
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

  onStartDateChange(event: any): void {
    this.startDate = event.value;
    console.log("Start Date:", this.startDate);
  }

  onEndDateChange(event: any): void {
    this.endDate = event.value;
    console.log("End Date:", this.endDate);
  }

  getCategoryAndBrand(): void {
    forkJoin({
      categories: this.categoryS.getCategory(),
      brands: this.brandS.getBrand(),
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

  onSearch() {
    let queryParamsObj = {};

    if (this.selectedOption === "name") {
      console.log("Selected Name:", this.itemName);
      console.log("Selected Category:", this.selectedCategory);
      console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        name: this.itemName,
        category: this.selectedCategory,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "category") {
      console.log("Selected Category:", this.selectedCategory);
      console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        name: null,
        category: this.selectedCategory,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "brand") {
      console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        name: null,
        category: null,
        brand: this.selectedBrand,
      };
    }
    else if (this.selectedOption === "date") {
      console.log(this.startDate, this.endDate);
      queryParamsObj['startDate'] = this.startDate.toISOString().slice(0, 10);
      queryParamsObj['endDate'] = this.endDate.toISOString().slice(0, 10);
    }

    console.log("Query Parameters:", queryParamsObj);

    // Now navigate with the queryParamsObj
    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams: queryParamsObj,
      queryParamsHandling: "merge",
    };

    this.router.navigate([], navigationExtras);
    this.getAllItems(queryParamsObj);
  }

  onClear() {
    // Reset all query parameters to null before setting new ones
    this.itemName = null;
    this.selectedCategory = null;
    this.selectedBrand = null;
    this.startDate = null;
    this.endDate = null;
    this.router.navigate([], {
      relativeTo: this.Router,
      queryParams: {
        name: null,
        category: null,
        brand: null,
        startDate: null,
        endDate: null
      },
      queryParamsHandling: "merge",
    });
    this.getAllItems(null);
    this.suggestions = null
  }

  getAllItems(queryParamsObj): void {
    console.log(queryParamsObj);
    this.item.getItem(queryParamsObj).subscribe(
      (response) => {
        this.items = response;
        console.log("All items here", this.items);
      },

      (error) => {
        console.error("Error retrieving items:", error);
        // Handle error here (e.g., show error message to the user)
      }
    );
  }

  openAddItemModal(): void {
    const dialogRef = this.dialog.open(AddItemsComponent, {
      width: "400px", // Adjust the width as needed
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Handle the result after the modal is closed
      if (result && result.data && result.data.itemName) {
        const newItemName = result.data.itemName;
        // Perform any actions with the new item name here
      }
    });
  }

  openAddCategoryModal(): void {
    const dialogRef = this.dialog.open(AddCategoryComponent, {
      width: "400px", // Adjust the width as needed
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Handle the result after the modal is closed
      if (result && result.data && result.data.categoryName) {
        const newCategoryName = result.data.categoryName;
        // Perform any actions with the new item name here
      }
    });
  }

  openAddBrandModal(): void {
    const dialogRef = this.dialog.open(AddBrandComponent, {
      width: "400px", // Adjust the width as needed
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Handle the result after the modal is closed
      if (result && result.data && result.data.brandName) {
        const newBrandName = result.data.brandName;
        // Perform any actions with the new item name here
      }
    });
  }

  viewItemDetails(itemId: string) {
    this.router.navigate(["/item-details", itemId]);
  }
}
