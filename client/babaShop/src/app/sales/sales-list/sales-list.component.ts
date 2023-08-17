import { ItemService } from 'app/shared/services/item.service';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddSalesComponent } from '../add-sales/add-sales.component';
import { SalesService } from 'app/shared/services/sales.service';
import { ActivatedRoute, NavigationExtras,Router } from '@angular/router';
import { CategoryService } from 'app/shared/services/category.service';
import { BrandService } from 'app/shared/services/brand.service';
import { Subject, forkJoin } from "rxjs";
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'sales-list',
  templateUrl: './sales-list.component.html',
  styleUrls: ['./sales-list.component.css'],
})
export class SalesListComponent implements OnInit {

  panelOpenState = false;
  Category: any = [];
  Brands: any = [];
  SalesList: any = [];
  name: string;
  category: string;
  brand: string;
  itemName: string = "";
  customer_name: string = "";
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
    private Sales: SalesService,
    private router: Router,
    private Router: ActivatedRoute,
    private categoryS: CategoryService,
    private brandS: BrandService,
    private Item: ItemService
  ) { }

  ngOnInit(): void {
    this.getAllItems("null");
    this.getCategoryAndBrand();
  }

  fetchSuggestions(): void {
    this.Item.getItemSuggestion(this.itemName).subscribe(
      (suggestions: any[]) => {
        this.suggestions = suggestions;
        console.log(this.suggestions)
      },
      (error: any) => {
        console.error('Error fetching suggestions:', error);
      }
    );
  }

  selectSuggestion(suggestion: string): void {
    this.itemName = suggestion;
    this.suggestions = [];
  }

  onStartDateChange(event: any): void {
    this.startDate = event.value;;
    console.log('Start Date:', this.startDate);
  }

  onEndDateChange(event: any): void {
    this.endDate = event.value;;
    console.log('End Date:', this.endDate);
  }

  onSearch() {
    let queryParamsObj = {};

    if (this.selectedOption === "name") {
      console.log("Selected Name:", this.itemName);
      console.log("Selected Cus_num", this.customer_name)

      queryParamsObj = {
        itemName: this.itemName,
        customerName: this.customer_name,
      };
    } else if (this.selectedOption === "category") {
      console.log("Selected Category:", this.selectedCategory);
      console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        itemName: null,
        category: this.selectedCategory,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "brand") {
      console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        itemName: null,
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
    this.customer_name = null;
    this.selectedCategory = null;
    this.selectedBrand = null;
    this.router.navigate([], {
      relativeTo: this.Router,
      queryParams: {
        itemName: null,
        category: null,
        brand: null,
        customer_name : null,
      },
      queryParamsHandling: "merge",
    });
    this.getAllItems(null);
  }


  getAllItems(queryParamsObj): void {
    // console.log(queryParamsObj)
    this.Sales.getSales(queryParamsObj).subscribe(
      (response) => {
        this.SalesList = response;
        console.log("All items here", this.SalesList);
      },

      (error) => {
        console.error("Error retrieving items:", error);
        // Handle error here (e.g., show error message to the user)
      }
    );
  }


  openAddBrandModal(): void{
    const dialogRef = this.dialog.open(AddSalesComponent, {
      width: "1000px", // Adjust the width as needed
    });

    dialogRef.afterClosed().subscribe((result) => {
      // Handle the result after the modal is closed
      if (result && result.data && result.data.brandName) {
        const newBrandName = result.data.brandName;
        // Perform any actions with the new item name here
      }
    });
  }


  getCategoryAndBrand(): void {
    forkJoin({
      categories: this.categoryS.getCategory(),
      brands: this.brandS.getBrand(),
    }).subscribe(
      (response) => {
        this.Category = response.categories;
        this.Brands = response.brands;
        // console.log("All Categories:", this.Category);
        // console.log("All Brands:", this.Brands);
      },
      (error) => {
        console.error("Error retrieving data:", error);
        // Handle error here (e.g., show error message to the user)
      }
    );
  }






}
