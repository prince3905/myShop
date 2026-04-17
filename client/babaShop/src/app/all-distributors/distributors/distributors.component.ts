import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { DistributorService } from "../../shared/services/distributor.service";
import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Subject, Subscription } from "rxjs";
import { MatDialog } from "@angular/material/dialog";
import { AddDistributorsComponent } from "../add-distributors/add-distributors.component";
import { ViewDistributorComponent } from "../view-distributor/view-distributor.component";
import { ShopService } from "app/shared/services/shop.service";
import { AuthService } from "app/shared/services/auth.service";

@Component({
  selector: "distributors",
  templateUrl: "./distributors.component.html",
  styleUrls: ["./distributors.component.css"],
})
export class DistributorsComponent implements OnInit, OnDestroy {
  panelOpenState = false;
  items: any[] = [];
  name: string;
  phone: any;
  searchInput: string;
  searchInputSubject = new Subject<string>();
  loading: boolean = true;

  Distributors: any[] = [];

  selectedOption: string = "name";
  searchParams = {};
  suggestions: any[] = [];

  pageSize = 10; // Number of items per page
  pageSizeOptions: number[] = [5, 10, 25, 50];
  paginatedItems: any[] = [];
  totalItems: number;
  currentPageIndex = 0;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  isEditMode: boolean;
  selectedDistributor: any;
  distributorForm: any;
  private shopSubscription?: Subscription;
  private lastShopId: string | null | undefined = undefined;
  isGlobalSuperAdmin = false;

  constructor(
    private distributor: DistributorService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private Router: ActivatedRoute,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private shopService: ShopService,
    private authService: AuthService,
  ) {}

  private navigateWithQuery(queryParams: any): void {
    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams,
    };

    this.router.navigate([], navigationExtras);
  }

  ngOnInit(): void {
    this.isGlobalSuperAdmin =
      this.authService.getUserRole() === "SUPER_ADMIN" &&
      !this.authService.getShopId();

    this.shopSubscription = this.shopService.selectedShop$.subscribe((shopId) => {
      this.isGlobalSuperAdmin =
        this.authService.getUserRole() === "SUPER_ADMIN" && !shopId;
      if (this.lastShopId === shopId) return;
      this.lastShopId = shopId;
      this.navigateWithQuery({
        page: 1,
        perPage: this.pageSize,
        name: this.name || null,
        phone: this.phone || null,
      });
    });

    this.Router.queryParams.subscribe((params) => {
      const page = Math.max(1, Number(params.page || 1));
      const perPage = Math.max(1, Number(params.perPage || this.pageSize));
      this.name = params.name || null;
      this.phone = params.phone || null;
      this.pageSize = perPage;
      this.currentPageIndex = page - 1;
      this.getAllDistributors({
        page,
        perPage,
        ...(this.name ? { name: this.name } : {}),
        ...(this.phone ? { phone: this.phone } : {}),
      });
    });
  }

  get activeFilterChips(): Array<{ key: string; label: string; value: string }> {
    const chips: Array<{ key: string; label: string; value: string }> = [];
    if (this.name) chips.push({ key: "name", label: "Name", value: this.name });
    if (this.phone) chips.push({ key: "phone", label: "Phone", value: this.phone });
    if (this.isGlobalSuperAdmin) {
      chips.push({ key: "mode", label: "Mode", value: "Global (read-only write blocked)" });
    }
    return chips;
  }

  ngOnDestroy(): void {
    this.shopSubscription?.unsubscribe();
  }

  getAllDistributors(queryParamsObj): void {
    this.loading = true;
    this.distributor.getDistributor(queryParamsObj).subscribe(
      (response: any) => {
        this.Distributors = response.distributors || [];
        this.totalItems = response.totalItems || 0;
        this.paginatedItems = [...this.Distributors];
        this.loading = false;
        this.cdr.detectChanges();
      },
      (error) => {
        this.loading = false;
        this.Distributors = [];
        this.paginatedItems = [];
      },
    );
  }

  getQueryParams(page = this.currentPageIndex + 1): any {
    let queryParamsObj: any = {
      page,
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
    this.pageSize = event.pageSize;
    this.navigateWithQuery(this.getQueryParams(event.pageIndex + 1));
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
    if (this.isGlobalSuperAdmin) {
      this.snackBar.open("Select a shop first to add distributor", "Close", {
        duration: 3000,
      });
      return;
    }
    this.dialog
      .open(AddDistributorsComponent, {
        width: "40%",
        height: "80%",
        data: null,
      })
      .afterClosed()
      .subscribe((res) => {
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
      width: "90%",
      height: "89%",
      data: item,
    });
  }

  onClear() {
    this.name = null;
    this.phone = null;
    this.navigateWithQuery({
      page: 1,
      perPage: this.pageSize,
      name: null,
      phone: null,
    });
    this.suggestions = null;
  }

  clearFilterChip(key: string): void {
    if (key === "name") {
      this.name = null;
      this.suggestions = [];
    }
    if (key === "phone") {
      this.phone = null;
      this.suggestions = [];
    }
    this.navigateWithQuery(this.getQueryParams(1));
  }

  onSearch(page: number, perPage: number) {
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

    this.navigateWithQuery(queryParamsObj);
  }

  fetchSuggestionsPhone(): void {
    this.distributor
      .getDistributorSuggestionPhone(this.phone || this.phone)
      .subscribe(
        (suggestions: any[]) => {
          this.suggestions = suggestions;
        },
        () => {},
      );
  }

  openEditDistributor(row: any) {
    if (this.isGlobalSuperAdmin) {
      this.snackBar.open("Select a shop first to edit distributor", "Close", {
        duration: 3000,
      });
      return;
    }
    this.dialog
      .open(AddDistributorsComponent, {
        width: "650px",
        data: row,
      })
      .afterClosed()
      .subscribe((res) => {
        if (res === true) {
          this.getAllDistributors("null");
          this.snackBar.open("Distributor updated successfully", "Close", {
            duration: 2000,
          });
        }
      });
  }

  editDistributor(item: any) {
    this.openEditDistributor(item);
  }

  openDistributorModal() {
    throw new Error("Method not implemented.");
  }

  toggleStatus(item: any): void {
    if (this.isGlobalSuperAdmin) {
      this.snackBar.open("Select a shop first to update status", "Close", {
        duration: 3000,
      });
      return;
    }
    // optimistic UI update pattern: toggle locally first, then call API
    const oldStatus = item.status;
    const newStatus = oldStatus === "disabled" ? "active" : "disabled";
    // immediate visual feedback
    item.status = newStatus;

    this.distributor.updateDistributorStatus(item._id, newStatus).subscribe({
      next: () => {},
      error: (err) => {
        item.status = oldStatus;
        console.error("Failed to update status", err);
        this.snackBar.open("Failed to update status. Try again.", "Close", {
          duration: 2500,
        });
      },
    });
  }

  updatePaginatedItems(): void {
    if (this.paginator) {
      const startIndex = this.paginator.pageIndex * this.pageSize;
      this.paginatedItems = this.Distributors.slice(
        startIndex,
        startIndex + this.pageSize,
      );
      this.cdr.detectChanges();
    } else {
      this.paginatedItems = [];
    }
  }
}
