import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, NavigationExtras, Router } from '@angular/router';
import { BrandService } from 'app/shared/services/brand.service';
import { CategoryService } from 'app/shared/services/category.service';
import { CustomerService } from 'app/shared/services/customer.service';
import { ItemService } from 'app/shared/services/item.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'customers',
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css']
})
export class CustomersComponent implements OnInit {

  panelOpenState = false;
  name: string;
  startDate: Date;
  endDate: Date;
  searchInput: string;
  searchInputSubject = new Subject<string>();
  loading: boolean = true;
  customers: any[] = [];

  selectedOption: string;

  searchParams = {};
  suggestions: string[] = [];

  pageSize = 10; // Number of items per page
  pageSizeOptions: number[] = [5, 10, 25, 50];
  paginatedItems: any[] = [];
  totalItems: number;

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(
    public dialog: MatDialog,
    private router: Router,
    private Router: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private customer: CustomerService
  ) { }

  ngOnInit(): void {
    this.getAllCustomer(null)
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
      queryParamsObj.name = this.name;
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
    this.getAllCustomer(queryParamsObj);
    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams: queryParamsObj,
      queryParamsHandling: "merge",
    };
    this.router.navigate([], navigationExtras);
    this.paginatedItems = this.customers.slice(
      event.pageIndex * this.pageSize,
      event.pageIndex * this.pageSize + this.pageSize
    );
  }

  // fetchSuggestions(): void {
  //   this.customers.getItemSuggestion(this.name).subscribe(
  //     (suggestions: any[]) => {
  //       this.suggestions = suggestions;
  //       // console.log(this.suggestions);
  //     },
  //     (error: any) => {
  //       console.error("Error fetching suggestions:", error);
  //     }
  //   );
  // }

  // selectSuggestion(suggestion: string): void {
  //   this.itemName = suggestion;
  //   this.suggestions = [];
  // }

  onStartDateChange(event: any): void {
    this.startDate = event.value;
    // console.log("Start Date:", this.startDate);
  }

  onEndDateChange(event: any): void {
    this.endDate = event.value;
    // console.log("End Date:", this.endDate);
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
        name: this.name,

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
    this.getAllCustomer(queryParamsObj);
  }

  onClear() {
    // Reset all query parameters to null before setting new ones
    this.name = null;
    this.startDate = null;
    this.endDate = null;
    this.router.navigate([], {
      relativeTo: this.Router,
      queryParams: {
        name: null,
        startDate: null,
        endDate: null,
      },
      queryParamsHandling: "merge",
    });
    this.getAllCustomer(null);
    this.suggestions = null;
  }

  getAllCustomer(queryParamsObj): void {
    this.loading = true;
    this.customer.getCustomer(queryParamsObj).subscribe(
      (response: any) => {
        this.customers = response.customers;
        console.log(response)
        this.totalItems = response.totalItems;
        this.paginatedItems = this.customers.slice(0, this.pageSize);
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
      this.paginatedItems = this.customers.slice(
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

}
