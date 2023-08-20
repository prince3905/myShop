import { Component, OnInit } from '@angular/core';
import { MatDialog } from "@angular/material/dialog";

import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { FormControl, Validators } from "@angular/forms";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";
import { Subject, forkJoin } from "rxjs";
import { StocksService } from 'app/shared/services/stocks.service';
import { ItemService } from 'app/shared/services/item.service';


@Component({
  selector: 'stocks',
  templateUrl: './stocks.component.html',
  styleUrls: ['./stocks.component.css']
})
export class StocksComponent implements OnInit {
  panelOpenState = false;
  Category: any = [];
  Brands: any = [];
  stocks: any = [];
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
    private stock: StocksService,
    private router: Router,
    private Router: ActivatedRoute,
    private categoryS: CategoryService,
    private brandS: BrandService,
    private item: ItemService,
  ) { }

  ngOnInit(): void {
    this.getStocks(null)
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

  selectSuggestion(suggestion: string): void {
    this.itemName = suggestion;
    this.suggestions = [];
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
    console.log("Query Parameters:", queryParamsObj);

    // Now navigate with the queryParamsObj
    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams: queryParamsObj,
      queryParamsHandling: "merge",
    };

    this.router.navigate([], navigationExtras);
    this.getStocks(queryParamsObj);
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
      },
      queryParamsHandling: "merge",
    });
    this.getStocks(null);
    this.suggestions = null
  }

  getStocks(queryParamsObj): void {
    this.stock.getStocks(queryParamsObj).subscribe(
      (response) => {
        this.stocks = response;
        console.log("All items here", this.stocks);
      },

      (error) => {
        console.error("Error retrieving stocks:", error);
        // Handle error here (e.g., show error message to the user)
      }
    );
  }

}
