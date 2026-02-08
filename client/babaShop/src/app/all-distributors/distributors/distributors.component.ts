import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { DistributorService } from "../../shared/services/distributor.service";
import { ChangeDetectorRef, Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { Subject } from "rxjs";
import { MatDialog } from "@angular/material/dialog";
import { AddDistributorsComponent } from "../add-distributors/add-distributors.component";

@Component({
  selector: "distributors",
  templateUrl: "./distributors.component.html",
  styleUrls: ["./distributors.component.css"],
})
export class DistributorsComponent implements OnInit {
  panelOpenState = false;
  // Category: any = [];
  // Brands: any = [];
  // items: any[] = [];
  name: string;
  phone: any;
  // category: string;
  // brand: string;
  // startDate: Date;
  // endDate: Date;
  searchInput: string;
  searchInputSubject = new Subject<string>();
  loading: boolean = true;
  Distributors: any[] = [];

  selectedOption: string;
  // selectedCategory: string;
  // selectedBrand: string;

  searchParams = {};
  suggestions: any[] = [];

  pageSize = 10; // Number of items per page
  pageSizeOptions: number[] = [5, 10, 25, 50];
  paginatedItems: any[] = [];
  totalItems: number;

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(
    private distributor: DistributorService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private Router: ActivatedRoute,
    public dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.getAllDistributors(null);
  }

  getAllDistributors(queryParamsObj): void {
    this.loading = true;
    this.distributor.getDistributor(queryParamsObj).subscribe(
      (response: any) => {
        this.Distributors = response.distributors        ;
        console.log(response);
        this.totalItems = response.totalItems;
        this.paginatedItems = this.Distributors.slice(0, this.pageSize);
        this.loading = false;
        this.cdr.detectChanges();
      },
      (error) => console.error("Error retrieving items:", error)
    );
    this.loading = true;
    this.cdr.detectChanges();
  }

  getQueryParams(): any {
    let queryParamsObj: any = {
      page: this.paginator.pageIndex + 1,
      perPage: this.pageSize,
    };
    if (this.selectedOption === "name") {
      queryParamsObj.name = this.name;
      // queryParamsObj.category = this.selectedCategory;
      // queryParamsObj.brand = this.selectedBrand;
    } else if (this.selectedOption === "phone") {
      queryParamsObj.phone = this.phone;
    } 
    return queryParamsObj;
  }

  onPageChange(event: PageEvent): void {
    // console.log(event)
    this.pageSize = event.pageSize;
    const queryParamsObj = this.getQueryParams();
    this.getAllDistributors(queryParamsObj);
    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams: queryParamsObj,
      queryParamsHandling: "merge",
    };
    this.router.navigate([], navigationExtras);
    this.paginatedItems = this.Distributors.slice(
      event.pageIndex * this.pageSize,
      event.pageIndex * this.pageSize + this.pageSize
    );
  }

  openAddItemModal(): void {
    const dialogRef = this.dialog.open(AddDistributorsComponent, {
      width: "400px",
    });
  }


  onClear() {
    // Reset all query parameters to null before setting new ones
    this.name= null;
    this.phone = null;
    this.router.navigate([], {
      relativeTo: this.Router,
      queryParams: {
        name: null,
        phone: null
        // category: null,
        // brand: null,
      },
      queryParamsHandling: "merge",
    });
    this.getAllDistributors(null);
    this.suggestions = null
  }

  selectSuggestion(suggestion: string): void {
    this.name = suggestion;
    this.phone = suggestion;
    this.suggestions = [];
  }


  fetchSuggestionsName(): void {
    // console.log(this.name)
    this.distributor.getDistributorSuggestionName(this.name).subscribe(
      (suggestions: any[]) => {
        this.suggestions = suggestions;
        console.log(this.suggestions);
      },
      (error: any) => {
        console.error("Error fetching suggestions:", error);
      }
    );
  }

  fetchSuggestionsPhone(): void {
    // console.log(this.phone)
    this.distributor.getDistributorSuggestionPhone(this.phone).subscribe(
      (suggestions: any[]) => {
        this.suggestions = suggestions;
        console.log(this.suggestions);
      },
      (error: any) => {
        console.error("Error fetching suggestions:", error);
      }
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
        name: this.name,
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
  }


  

  updatePaginatedItems(): void {
    if (this.paginator) {
      const startIndex = this.paginator.pageIndex * this.pageSize;
      // console.log(startIndex)
      this.paginatedItems = this.Distributors.slice(
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
