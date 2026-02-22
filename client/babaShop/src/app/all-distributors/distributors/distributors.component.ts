import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { DistributorService } from "../../shared/services/distributor.service";
import { ChangeDetectorRef, Component, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Subject } from "rxjs";
import { MatDialog } from "@angular/material/dialog";
import { AddDistributorsComponent } from "../add-distributors/add-distributors.component";
import { ViewDistributorComponent } from "../view-distributor/view-distributor.component";

@Component({
  selector: "distributors",
  templateUrl: "./distributors.component.html",
  styleUrls: ["./distributors.component.css"],
})
export class DistributorsComponent implements OnInit {
  panelOpenState = false;
  // Category: any = [];
  // Brands: any = [];
  items: any[] = [];
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
  isEditMode: boolean;
  selectedDistributor: any;
  distributorForm: any;

  constructor(
    private distributor: DistributorService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private Router: ActivatedRoute,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.getAllDistributors(null);
  }

  getAllDistributors(queryParamsObj): void {
    this.loading = true;
    this.distributor.getDistributor(queryParamsObj).subscribe(
      (response: any) => {
        this.Distributors = response.distributors || [];
        console.log(response);
        this.totalItems = response.totalItems || 0;
        this.paginatedItems = this.Distributors.slice(0, this.pageSize);
        this.loading = false;
        this.cdr.detectChanges();
      },
      (error) => console.error("Error retrieving items:", error),
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
      event.pageIndex * this.pageSize + this.pageSize,
    );
  }

  fetchSuggestionsName(): void {
    if (!this.name || this.name.length < 1) {
      this.suggestions = [];
      return;
    }

    this.distributor
      .getDistributorSuggestionName(this.name)
      .subscribe((res: any[]) => {
        this.suggestions = [...res];
      });
  }

  selectSuggestion(suggestion: string): void {
    this.name = suggestion;
    this.suggestions = [];
  }

  openAddDistributor() {
    console.log("Opening Add Distributor Modal");

    this.dialog
      .open(AddDistributorsComponent, {
        width: "100%",
        height: "100%",
        data: null, // 🔥 MUST BE NULL
      })
      .afterClosed()
      .subscribe((res) => {
        console.log("Dialog Closed:", res);

        if (res === true) {
          this.getAllDistributors(null);
          this.snackBar.open("Distributor list refreshed", "Close", {
            duration: 2000,
          });
        }
      });
  }

  openViewDistributor(item: any, event: Event): void {
    event.stopPropagation();

    this.dialog.open(ViewDistributorComponent, {
      width: "900px",
      height: "800px",
      data: item,
    });
  }

  onClear() {
    // Reset all query parameters to null before setting new ones
    this.name = null;
    this.phone = null;
    this.router.navigate([], {
      relativeTo: this.Router,
      queryParams: {
        name: null,
        phone: null,
        // category: null,
        // brand: null,
      },
      queryParamsHandling: "merge",
    });
    this.getAllDistributors(null);
    this.suggestions = null;
  }

  onSearch(page: number, perPage: number) {
    this.paginator.pageIndex = 0;

    let queryParamsObj: any = {
      page: 1,
      perPage: this.pageSize,
    };

    if (this.selectedOption === "name" && this.name) {
      queryParamsObj.name = this.name;
    }

    if (this.selectedOption === "phone" && this.phone) {
      queryParamsObj.phone = this.phone;
    }

    console.log("Search Params:", queryParamsObj);

    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams: queryParamsObj,
      queryParamsHandling: "merge",
    };

    this.router.navigate([], navigationExtras);
    this.getAllDistributors(queryParamsObj);
  }

  fetchSuggestionsPhone(): void {
    // console.log(this.phone)
    this.distributor
      .getDistributorSuggestionPhone(this.phone || this.phone)
      .subscribe(
        (suggestions: any[]) => {
          this.suggestions = suggestions;
          console.log(this.suggestions);
        },
        (error: any) => {
          console.error("Error fetching suggestions:", error);
        },
      );
  }

  openEditDistributor(row: any) {
    console.log("Editing Distributor:", row);

    this.dialog
      .open(AddDistributorsComponent, {
        width: "650px",
        data: row,
      })
      .afterClosed()
      .subscribe((res) => {
        console.log("Dialog Closed:", res);

        if (res === true) {
          this.getAllDistributors("null");
          this.snackBar.open("Distributor updated successfully", "Close", {
            duration: 2000,
          });
        }
      });
  }

  openDistributorModal() {
    throw new Error("Method not implemented.");
  }

  toggleStatus(item: any): void {
    // optimistic UI update pattern: toggle locally first, then call API
    const oldStatus = item.status;
    const newStatus = oldStatus === "disabled" ? "active" : "disabled";
    // immediate visual feedback
    item.status = newStatus;

    this.distributor.updateDistributorStatus(item._id, newStatus).subscribe({
      next: (res) => {
        // success — server applied change, optionally refresh or show toast
        // console.log('Status updated', res);
      },
      error: (err) => {
        // revert on error
        item.status = oldStatus;
        console.error("Failed to update status", err);
        alert("Failed to update status. Try again.");
      },
    });
  }

  updatePaginatedItems(): void {
    if (this.paginator) {
      const startIndex = this.paginator.pageIndex * this.pageSize;
      // console.log(startIndex)
      this.paginatedItems = this.Distributors.slice(
        startIndex,
        startIndex + this.pageSize,
      );
      // console.log("if",this.paginatedItems)
      this.cdr.detectChanges();
    } else {
      this.paginatedItems = [];
      // console.log("else",this.paginatedItems)
    }
  }
}
