import { Component, OnInit, ViewChild, ChangeDetectorRef} from '@angular/core';
import { ActivatedRoute, NavigationExtras, Router } from '@angular/router';
import { OrderService } from 'app/shared/services/order.service';
import { MatDialog } from '@angular/material/dialog';
import { SalesService } from 'app/shared/services/sales.service';
import { CategoryService } from 'app/shared/services/category.service';
import { BrandService } from 'app/shared/services/brand.service';
import { Subject, forkJoin } from "rxjs";
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { DatePipe } from '@angular/common';
import { MatPaginator, PageEvent } from '@angular/material/paginator';



@Component({
  selector: 'orders',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css']
})
export class OrdersComponent implements OnInit {
  panelOpenState = false;
  Category: any = [];
  Brands: any = [];
  OrderList: any = [];
  name: string;
  category: string;
  brand: string;
  itemName: string = "";
  customer_name: string = "";
  startDate: Date;
  endDate: Date;
  searchInput: string;
  searchInputSubject = new Subject<string>();
  loading: boolean = true;

  selectedOption: string;
  selectedCategory: string;
  selectedBrand: string;

  searchParams = {};
  suggestions: string[] = [];
  cus_suggestions: string[] = [];

  pageSize = 10; // Number of items per page
  pageSizeOptions: number[] = [5, 10, 25, 50];
  paginatedItems: any[] = [];
  totalItems: number;

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(
    private order: OrderService,
    private router: Router,
    private Router: ActivatedRoute,
    public dialog: MatDialog,
    private categoryS: CategoryService,
    private brandS: BrandService,
    private cdr: ChangeDetectorRef


  ) { }

  ngOnInit(): void {
    this.getAllOrders(null);
    this.getCategoryAndBrand();
    this.updatePaginatedItems();
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
    this.getAllOrders(queryParamsObj);
    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams: queryParamsObj,
      queryParamsHandling: "merge",
    };
    this.router.navigate([], navigationExtras);
    this.paginatedItems = this.OrderList.slice(
      event.pageIndex * this.pageSize,
      event.pageIndex * this.pageSize + this.pageSize
    );
  }

  // fetchSuggestions(): void {
  //   this.Item.getItemSuggestion(this.itemName).subscribe(
  //     (suggestions: any[]) => {
  //       this.suggestions = suggestions;
  //       console.log(this.suggestions)
  //     },
  //     (error: any) => {
  //       console.error('Error fetching suggestions:', error);
  //     }
  //   );
  // }

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

  onSearch(page: number, perPage: number) {
    this.paginator.pageIndex = 0;
    let queryParamsObj: any = {
      page: 1,
      perPage: perPage,
    };

    if (this.selectedOption === "name") {
      console.log("Selected Name:", this.itemName);
      console.log("Selected Cus_num", this.customer_name)

      queryParamsObj = {
        ...queryParamsObj,
        itemName: this.itemName,
        customerName: this.customer_name,
      };
    } else if (this.selectedOption === "category") {
      console.log("Selected Category:", this.selectedCategory);
      console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        ...queryParamsObj,
        itemName: null,
        category: this.selectedCategory,
        brand: this.selectedBrand,
      };
    } else if (this.selectedOption === "brand") {
      console.log("Selected Brand:", this.selectedBrand);

      queryParamsObj = {
        ...queryParamsObj,
        itemName: null,
        category: null,
        brand: this.selectedBrand,
      };
    }
    else if (this.selectedOption === "date") {
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
    this.getAllOrders(queryParamsObj);
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
    this.getAllOrders(null);
    this.suggestions = null;
    this.cus_suggestions = null
  }



  getAllOrders(queryParamsObj): void {
    this.loading = true;
    this.order.getAllOrder(null).subscribe(
      (response: any) => {
        console.log(response)
        this.OrderList = response.orders;
        this.totalItems = response.totalItems;
        this.paginatedItems = this.OrderList.slice(0, this.pageSize);
        this.loading = false;
        this.cdr.detectChanges();
        console.log("All items here", this.OrderList);

      },
      (error) => {
        console.error('Error retrieving orders:', error);
        this.loading = true;
        this.cdr.detectChanges();
        // Handle error here (e.g., show error message to the user)
      }
    );
  }

  updatePaginatedItems(): void {
    if (this.paginator) {
      const startIndex = this.paginator.pageIndex * this.pageSize;
      // console.log(startIndex)
      this.paginatedItems = this.OrderList.slice(
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
