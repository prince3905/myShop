import { Component, OnInit, ViewChild } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";

import { AddItemsComponent } from "../add-items/add-items.component";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { Subject, forkJoin } from "rxjs";
import { AddCategoryComponent } from "../add-category/add-category.component";
import { AddBrandComponent } from "../add-brand/add-brand.component";

import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { ProductService } from "app/shared/services/product.service";
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

  productId: string;
  isEditMode = false;

  selectedOption: string;
  selectedCategory: string;
  selectedBrand: string;
  searchParams = {};
  suggestions: string[] = [];

  pageSize = 10; // Number of items per page
  pageSizeOptions: number[] = [5, 10, 25, 50];
  paginatedItems: any[] = [];
  totalItems: number;

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(
    public dialog: MatDialog,
    private productService: ProductService,
    private router: Router,
    private Router: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.loadProducts();
  }

  toggleVariations(item: any) {
    item.showVariations = !item.showVariations;
  }

  loadProducts() {
    this.productService.getAllProducts().subscribe((res: any) => {
      this.items = res.data || res; // depends backend response
      console.log("All Products", this.items);

      this.items.forEach((item: any) => {
        item.totalStock =
          item.variations?.reduce(
            (sum: number, v: any) => sum + (v.quantity ? v.quantity : 0),
            0,
          ) || 0;
      });

      this.totalItems = this.items.length;
      this.paginatedItems = this.items.slice(0, this.pageSize);

      this.loading = false;
    });
  }

  ngAfterViewInit(): void {
    this.paginator.page.subscribe(() => this.updatePaginatedItems());
    console.log(this.paginator);
    this.updatePaginatedItems();
    console.log(this.updatePaginatedItems);
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
    // this.getAllItems(queryParamsObj);
    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams: queryParamsObj,
      queryParamsHandling: "merge",
    };
    this.router.navigate([], navigationExtras);
    this.paginatedItems = this.items.slice(
      event.pageIndex * this.pageSize,
      event.pageIndex * this.pageSize + this.pageSize,
    );
  }

  // fetchSuggestions(): void {
  //   this.item.getItemSuggestion(this.itemName).subscribe(
  //     (suggestions: any[]) => {
  //       this.suggestions = suggestions;
  //       // console.log(this.suggestions);
  //     },
  //     (error: any) => {
  //       console.error("Error fetching suggestions:", error);
  //     }
  //   );
  // }

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

  // getCategoryAndBrand(): void {
  //   forkJoin({
  //     categories: this.categoryS.getCategory(),
  //     brands: this.brandS.getBrand(),
  //   }).subscribe(
  //     (response) => {
  //       this.Category = response.categories;
  //       this.Brands = response.brands;
  //     },
  //     (error) => console.error("Error retrieving data:", error),
  //   );
  // }

  onSearch(page: number, perPage: number) {
    this.paginator.pageIndex = 0;
    let queryParamsObj: any = {
      page: 1,
      perPage: perPage,
    };

    if (this.selectedOption === "name") {
      queryParamsObj = {
        ...queryParamsObj,
        name: this.itemName,
        category: this.selectedCategory,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "category") {
      queryParamsObj = {
        ...queryParamsObj,
        name: null,
        category: this.selectedCategory,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "brand") {
      queryParamsObj = {
        ...queryParamsObj,
        name: null,
        category: null,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "date") {
      console.log(this.startDate, this.endDate);
      queryParamsObj = {
        ...queryParamsObj,
        startDate: this.startDate.toISOString().slice(0, 10),
        endDate: this.endDate.toISOString().slice(0, 10),
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
    // this.getAllItems(queryParamsObj);
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
    // this.getAllItems(null);
    this.suggestions = null;
  }

  // getAllItems(queryParamsObj): void {
  //   this.loading = true;
  //   this.item.getItem(queryParamsObj).subscribe(
  //     (response: any) => {
  //       this.items = response.items;
  //       console.log(response)
  //       this.totalItems = response.totalItems;
  //       this.paginatedItems = this.items.slice(0, this.pageSize);
  //       this.loading = false;
  //     this.cdr.detectChanges();
  //     },
  //     (error) => console.error("Error retrieving items:", error)
  //   );
  //   this.loading = true;
  //   this.cdr.detectChanges();
  // }

  updatePaginatedItems(): void {
    const startIndex = this.paginator.pageIndex * this.pageSize;
    this.paginatedItems = this.items.slice(
      startIndex,
      startIndex + this.pageSize,
    );
  }

  openAddItemModal(): void {
    const dialogRef = this.dialog.open(AddItemsComponent, {
      width: "500px",
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

  editProduct(id: string) {
    this.router.navigate(["/add-items", id]);
  }

  // openEditProduct(item: any, event: Event) {
  //   event.stopPropagation();

  //   const dialogRef = this.dialog.open(AddItemsComponent, {
  //     width: "500px",
  //     data: { product: item }, // 👈 passing full product
  //   });

  //   dialogRef.afterClosed().subscribe((result) => {
  //     if (result) {
  //       this.loadProducts(); // reload list after update
  //     }
  //   });
  // }
}
