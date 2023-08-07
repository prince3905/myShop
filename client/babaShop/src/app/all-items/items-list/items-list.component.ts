import { ComponentsModule } from "./../../components/components.module";
import { Component, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";

import { AddItemsComponent } from "../add-items/add-items.component";
import { ItemService } from "app/shared/services/item.service";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { FormControl, Validators } from "@angular/forms";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { forkJoin } from "rxjs";
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

  selectedOption: string;
  // categories: string[] = ["Category 1", "Category 2", "Category 3"];
  // brands: string[] = ["Brand 1", "Brand 2", "Brand 3"];

  selectedCategory: string;
  selectedBrand: string;

  searchParams = {};

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

  // onSearch() {
  //   if (this.selectedOption === "name") {
  //     console.log("Selected Name:", this.itemName);
  //     console.log("Selected Category:", this.selectedCategory);
  //     console.log("Selected Brand:", this.selectedBrand);
  //     this.router.navigate([], {
  //       relativeTo: this.Router,
  //       queryParams: {
  //         name: this.itemName,
  //         category: this.selectedCategory,
  //         brand: this.selectedBrand,
  //       },
  //       queryParamsHandling: "merge",
  //     });
  //   } else if (this.selectedOption === "category") {
  //     console.log("Selected Category:", this.selectedCategory);
  //     console.log("Selected Category:", this.selectedBrand);
  //     this.router.navigate([], {
  //       relativeTo: this.Router,
  //       queryParams: {
  //         name: null,
  //         category: this.selectedCategory,
  //         brand: this.selectedBrand,
  //       },
  //       queryParamsHandling: "merge",
  //     });
  //   } else if (this.selectedOption === "brand") {
  //     console.log("Selected Brand:", this.selectedBrand);
  //     this.router.navigate([], {
  //       relativeTo: this.Router,
  //       queryParams: {
  //         name: null,
  //         category: null,
  //         brand: this.selectedBrand,
  //       },
  //       queryParamsHandling: "merge",
  //     });
  //   }
  // }

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

  console.log("Query Parameters:", queryParamsObj);

  // Now navigate with the queryParamsObj
  const navigationExtras: NavigationExtras = {
    relativeTo: this.Router,
    queryParams: queryParamsObj,
    queryParamsHandling: "merge",
  };

  this.router.navigate([], navigationExtras);
  this.getAllItems(queryParamsObj)
}
  

  onClear() {
    // Reset all query parameters to null before setting new ones
    this.itemName = null;
    this.selectedCategory = null;
    this.selectedBrand = null;
    this.router.navigate([], {
      relativeTo: this.Router,
      queryParams: {
        name: null,
        category: null,
        brand: null,
      },
      queryParamsHandling: "merge",
    });
  }

  getAllItems(queryParamsObj): void {
    console.log(queryParamsObj)
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

  openAddCategoryModal(): void{
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

  openAddBrandModal(): void{
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
