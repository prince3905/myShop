import { ComponentsModule } from "./../../components/components.module";
import { ChangeDetectorRef, Component, OnInit, ViewChild } from "@angular/core";
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

import { MatPaginator, PageEvent } from "@angular/material/paginator";
@Component({
  selector: "items-list",
  templateUrl: "./items-list.component.html",
  styleUrls: ["./items-list.component.css"],
})
export class ItemsListComponent implements OnInit {
  panelOpenState = false;
  Category: any = [];
  Brands: any = [];
  items: any[] = [];
  name: string;
  category: string;
  brand: string;
  itemName: string = "";
  startDate: Date;
  endDate: Date;
  searchInput: string;
  searchInputSubject = new Subject<string>();
  loading: boolean = true;


  selectedOption: string;
  selectedCategory: string;
  selectedBrand: string;
  selectedVariantQuantity: number;
  selectedVariantPrice: number;
  selectedVariant: { [itemId: string]: any } = {};
  selectedModel: { [itemId: string]: string } = {};
  selectedOrderNumber: { [itemId: string]: string } = {};

  searchParams = {};
  suggestions: string[] = [];

  pageSize = 10; // Number of items per page
  pageSizeOptions: number[] = [5, 10, 25, 50];
  paginatedItems: any[] = [];
  totalItems: number;

  isSoldOut(soldOut: boolean): string {
    return soldOut ? 'Yes' : 'No';
  } 

  @ViewChild(MatPaginator) paginator: MatPaginator;


  constructor(
    public dialog: MatDialog,
    private item: ItemService,
    private router: Router,
    private Router: ActivatedRoute,
    private categoryS: CategoryService,
    private brandS: BrandService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.getAllItems(null);
    this.getCategoryAndBrand();
    this.updatePaginatedItems();
    for (const item of this.items) {
      item.selectedModel = '';
      item.selectedModelVariations = [];
      item.selectedVariant = null; 
    }
  }

  onModelChange(item: any): void {
    // Find the selected model object based on the selectedModel value
    const selectedModelObject = item.models.find((model) => model.model === item.selectedModel);
    if (selectedModelObject) {
      // Update the size property with the size of the selected model
      item.size = selectedModelObject.size;
      item.selectedModelVariations = selectedModelObject.variations;
    } else {
      // Handle the case when no model is selected (optional)
      item.size = '';
      item.selectedModelVariations = [];
    }
  
    // Update selectedModelVariations with the variations for the selected model
    item.selectedModelVariations = selectedModelObject ? selectedModelObject.variations : [];

    console.log("Selected Model:", item.selectedModel);
    console.log("Selected Model Variations:", item.selectedModelVariations);
  }

  updateSelectedVariantInfo(item: any, selectedOrderNumber: string): void {
    console.log('updateSelectedVariantInfo called for item:', item);
    console.log('Selected Order Number:', selectedOrderNumber);
  
    // Log the selectedModelVariations array to verify its content
    console.log('Selected Model Variations:', item.selectedModelVariations);
  
    const selectedVariant = item.selectedModelVariations.find((variation) => variation.orderNumber === selectedOrderNumber);
    
    if (selectedVariant) {
      this.selectedVariant[item._id] = selectedVariant;
      this.cdr.detectChanges();
      console.log('Selected Variant:', selectedVariant);
    } else {
      // this.selectedVariant[item._id] = null;
      this.cdr.detectChanges(); 
      console.log('Selected Variant not found');
    }
  }
  
  

  ngAfterViewInit(): void {
    this.paginator.page.subscribe(() => this.updatePaginatedItems());
    // console.log(this.paginator)
    this.updatePaginatedItems();
    // console.log(this.updatePaginatedItems)
  }

  getQueryParams(): any {
    let queryParamsObj: any = {
      page: this.paginator.pageIndex + 1,
      perPage: this.pageSize,
    };
    if (this.selectedOption === "name") {
      queryParamsObj.name = this.itemName;
      queryParamsObj.category = this.selectedCategory;
      queryParamsObj.brand = this.selectedBrand;
    } else if (this.selectedOption === "category") {
      queryParamsObj.category = this.selectedCategory;
      queryParamsObj.brand = this.selectedBrand;
    } else if (this.selectedOption === "brand") {
      queryParamsObj.brand = this.selectedBrand;
    } else if (this.selectedOption === "date") {
      queryParamsObj.startDate = this.startDate.toISOString().slice(0, 10);
      queryParamsObj.endDate = this.endDate.toISOString().slice(0, 10);
    }
    return queryParamsObj;
  }

  onPageChange(event: PageEvent): void {
    // console.log(event)
    this.pageSize = event.pageSize;
    const queryParamsObj = this.getQueryParams();
    this.getAllItems(queryParamsObj);
    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams: queryParamsObj,
      queryParamsHandling: "merge",
    };
    this.router.navigate([], navigationExtras);
    this.paginatedItems = this.items.slice(
      event.pageIndex * this.pageSize,
      event.pageIndex * this.pageSize + this.pageSize
    );
  }

  fetchSuggestions(): void {
    this.item.getItemSuggestion(this.itemName).subscribe(
      (suggestions: any[]) => {
        this.suggestions = suggestions;
        // console.log(this.suggestions);
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
    // console.log("Start Date:", this.startDate);
  }

  onEndDateChange(event: any): void {
    this.endDate = event.value;
    // console.log("End Date:", this.endDate);
  }

  getCategoryAndBrand(): void {
    forkJoin({
      categories: this.categoryS.getCategory(),
      brands: this.brandS.getBrand(),
    }).subscribe(
      (response) => {
        this.Category = response.categories;
        this.Brands = response.brands;
      },
      (error) => console.error("Error retrieving data:", error)
    );
  }

  onSearch(page: number, perPage: number) {
    this.paginator.pageIndex = 0;
    let queryParamsObj: any = {
      page: 1,
      perPage: perPage,
    };

    if (this.selectedOption === "name") {
      // console.log("Selected Name:", this.itemName);
      // console.log("Selected Category:", this.selectedCategory);
      // console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        ...queryParamsObj,
        name: this.itemName,
        category: this.selectedCategory,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "category") {
      // console.log("Selected Category:", this.selectedCategory);
      // console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        ...queryParamsObj,
        name: null,
        category: this.selectedCategory,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "brand") {
      // console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        ...queryParamsObj,
        name: null,
        category: null,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "date") {
      // console.log(this.startDate, this.endDate);
      queryParamsObj = {
        ...queryParamsObj,
        startDate: this.startDate.toISOString().slice(0, 10),
        endDate: this.endDate.toISOString().slice(0, 10),
      };
    }

    // console.log("Query Parameters:", queryParamsObj);

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
        endDate: null,
      },
      queryParamsHandling: "merge",
    });
    this.getAllItems(null);
    this.suggestions = null;
  }

  getAllItems(queryParamsObj): void {
    this.loading = true;
    this.item.getItem(queryParamsObj).subscribe(
      (response: any) => {
        this.items = response.items;
        console.log(response)
        this.totalItems = response.totalItems;
        this.paginatedItems = this.items.slice(0, this.pageSize);
        this.loading = false;
      this.cdr.detectChanges();
      },
      (error) => console.error("Error retrieving items:", error)
    );
    this.loading = true;
    this.cdr.detectChanges();
  }

  updatePaginatedItems(): void {
    if (this.paginator) {
      const startIndex = this.paginator.pageIndex * this.pageSize;
      // console.log(startIndex)
      this.paginatedItems = this.items.slice(
        startIndex,
        startIndex + this.pageSize
      );
      // console.log("if",this.paginatedItems)
      this.cdr.detectChanges();
    } else {
      this.paginatedItems = [];
      // console.log("else",this.paginatedItems)
    }
  }

  openAddItemModal(): void {
    const dialogRef = this.dialog.open(AddItemsComponent, {
      width: "1000px",
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.data && result.data.itemName) {
        const newItemName = result.data.itemName;
      }
    });
  }

  openAddCategoryModal(): void {
    const dialogRef = this.dialog.open(AddCategoryComponent, {
      width: "400px",
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.data && result.data.categoryName) {
        const newCategoryName = result.data.categoryName;
      }
    });
  }

  openAddBrandModal(): void {
    const dialogRef = this.dialog.open(AddBrandComponent, {
      width: "400px",
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.data && result.data.brandName) {
        const newBrandName = result.data.brandName;
      }
    });
  }

  viewItemDetails(itemId: string) {
    this.router.navigate(["/item-details", itemId]);
  }
}
