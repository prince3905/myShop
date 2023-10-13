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
  Distributors: any[] = [];

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
}
