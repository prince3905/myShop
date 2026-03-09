import { Component, OnInit, ViewChild } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";

import { AddItemsComponent } from "../add-items/add-items.component";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { Subject, forkJoin } from "rxjs";
import { AddCategoryComponent } from "../add-category/add-category.component";
import { AddBrandComponent } from "../add-brand/add-brand.component";

import { MatPaginator, PageEvent } from "@angular/material/paginator";
import { ProductService } from "app/shared/services/product.service";
import { CategoryService } from "app/shared/services/category.service";
import { BrandService } from "app/shared/services/brand.service";
import { AuthService } from "app/shared/services/auth.service";
@Component({
  selector: "items-list",
  templateUrl: "./items-list.component.html",
  styleUrls: ["./items-list.component.css"],
})
export class ItemsListComponent implements OnInit {
  panelOpenState = false;
  Category: any = [];
  Brands: any = [];
  filteredBrands: any[] = [];
  allItems: any[] = [];
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
  summaryCounts = {
    products: 0,
    categories: 0,
    brands: 0,
  };

  productId: string;
  isEditMode = false;

  selectedOption: string;
  selectedCategory: string;
  selectedBrand: string;
  searchParams = {};

  pageSize = 10;
  pageSizeOptions: number[] = [5, 10, 25, 50];
  paginatedItems: any[] = [];
  totalItems: number;

  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(
    public dialog: MatDialog,
    private productService: ProductService,
    private categoryService: CategoryService,
    private brandService: BrandService,
    public authService: AuthService,
    private router: Router,
    private Router: ActivatedRoute,
  ) {}

  private navigateWithQuery(queryParams: any): void {
    const navigationExtras: NavigationExtras = {
      relativeTo: this.Router,
      queryParams,
      queryParamsHandling: "merge",
    };

    this.router.navigate([], navigationExtras);
  }

  ngOnInit() {
    this.getCategoryAndBrand();
    this.loadProducts();
  }

  toggleVariations(item: any) {
    item.showVariations = !item.showVariations;
  }

  loadProducts() {
    this.productService.getAllProducts().subscribe((res: any) => {
      this.allItems = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
      this.items = [...this.allItems];
      this.summaryCounts.products = this.allItems.length;

      this.allItems.forEach((item: any) => {
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
    if (!this.paginator) return;
    this.paginator.page.subscribe(() => this.updatePaginatedItems());
    this.updatePaginatedItems();
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
    this.pageSize = event.pageSize;
    this.navigateWithQuery(this.getQueryParams());
    this.paginatedItems = this.items.slice(
      event.pageIndex * this.pageSize,
      event.pageIndex * this.pageSize + this.pageSize,
    );
  }

  onStartDateChange(event: any): void {
    this.startDate = event.value;
    this.onFilterInputChange();
  }

  onEndDateChange(event: any): void {
    this.endDate = event.value;
    this.onFilterInputChange();
  }

  getCategoryAndBrand(): void {
    forkJoin({
      categories: this.categoryService.getAllCategories({ page: 1, limit: 500 }),
      brands: this.brandService.getAllBrands({ page: 1, limit: 500 }),
    }).subscribe({
      next: (response: any) => {
        this.Category = this.extractList(response?.categories);
        this.Brands = this.extractList(response?.brands);
        this.updateFilteredBrands();
        this.summaryCounts.categories = this.Category.length;
        this.summaryCounts.brands = this.Brands.length;
      },
      error: (error) => console.error("Error retrieving category/brand:", error),
    });
  }

  onSearch(page: number, perPage: number) {
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
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
      queryParamsObj = {
        ...queryParamsObj,
        startDate: this.startDate.toISOString().slice(0, 10),
        endDate: this.endDate.toISOString().slice(0, 10),
      };
    }

    this.navigateWithQuery(queryParamsObj);
    this.applyFilters();
  }

  onFilterModeChange(): void {
    this.itemName = "";
    this.selectedCategory = null;
    this.selectedBrand = null;
    this.startDate = null;
    this.endDate = null;
    this.items = [...this.allItems];
    this.totalItems = this.items.length;
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.updateFilteredBrands();
    this.updatePaginatedItems();
  }

  onFilterInputChange(): void {
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.updateFilteredBrands();
    this.applyFilters();
  }

  onClear() {
    this.itemName = null;
    this.selectedCategory = null;
    this.selectedBrand = null;
    this.startDate = null;
    this.endDate = null;
    this.navigateWithQuery({
      name: null,
      category: null,
      brand: null,
      startDate: null,
      endDate: null,
    });
    this.selectedOption = null;
    this.items = [...this.allItems];
    this.totalItems = this.items.length;
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.updateFilteredBrands();
    this.updatePaginatedItems();
  }

  // getAllItems(queryParamsObj): void {
  //   this.loading = true;
  //   this.item.getItem(queryParamsObj).subscribe(
  //     (response: any) => {
  //       this.items = response.items;
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
    const pageIndex = this.paginator?.pageIndex || 0;
    const startIndex = pageIndex * this.pageSize;
    this.paginatedItems = this.items.slice(
      startIndex,
      startIndex + this.pageSize,
    );
  }

  private applyFilters(): void {
    const byName = (item: any): boolean => {
      if (!this.itemName?.trim()) return true;
      return (item?.name || "").toLowerCase().includes(this.itemName.trim().toLowerCase());
    };

    const byCategory = (item: any): boolean => {
      if (!this.selectedCategory) return true;
      return item?.category?._id === this.selectedCategory;
    };

    const byBrand = (item: any): boolean => {
      if (!this.selectedBrand) return true;
      return item?.brand?._id === this.selectedBrand;
    };

    const byDate = (item: any): boolean => {
      if (!this.startDate && !this.endDate) return true;
      const createdAt = new Date(item?.createdAt);
      if (Number.isNaN(createdAt.getTime())) return false;

      if (this.startDate) {
        const from = new Date(this.startDate);
        from.setHours(0, 0, 0, 0);
        if (createdAt < from) return false;
      }
      if (this.endDate) {
        const to = new Date(this.endDate);
        to.setHours(23, 59, 59, 999);
        if (createdAt > to) return false;
      }
      return true;
    };

    this.items = this.allItems.filter((item: any) => {
      if (this.selectedOption === "name") {
        return byName(item) && byCategory(item) && byBrand(item);
      }
      if (this.selectedOption === "category") {
        return byCategory(item) && byBrand(item);
      }
      if (this.selectedOption === "brand") {
        return byBrand(item);
      }
      if (this.selectedOption === "date") {
        return byDate(item);
      }
      return true;
    });

    this.totalItems = this.items.length;
    this.updatePaginatedItems();
  }

  private extractList(response: any): any[] {
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response)) return response;
    return [];
  }

  private updateFilteredBrands(): void {
    const selectedCategoryObj = this.Category.find(
      (category: any) => `${category?._id || ""}` === `${this.selectedCategory || ""}`,
    );

    const mappedBrandIds = Array.isArray(selectedCategoryObj?.brands)
      ? selectedCategoryObj.brands.map((brand: any) =>
          typeof brand === "string" ? brand : `${brand?._id || ""}`,
        )
      : [];

    this.filteredBrands = mappedBrandIds.length
      ? this.Brands.filter((brand: any) => mappedBrandIds.includes(`${brand?._id || ""}`))
      : [...this.Brands];

    const isSelectedBrandValid = this.filteredBrands.some(
      (brand: any) => `${brand?._id || ""}` === `${this.selectedBrand || ""}`,
    );

    if (this.selectedBrand && !isSelectedBrandValid) {
      this.selectedBrand = null;
    }
  }

  openAddItemModal(): void {
    const dialogRef = this.dialog.open(AddItemsComponent, {
      width: "500px",
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.created && result?.productId) {
        this.router.navigate(["/add-detail", result.productId]);
        return;
      }
      this.loadProducts();
    });
  }

  openAddCategoryModal(): void {
    const dialogRef = this.dialog.open(AddCategoryComponent, {
      width: "1240px",
      maxWidth: "96vw",
      height: "90vh",
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result && result.data && result.data.categoryName) {
        const newCategoryName = result.data.categoryName;
      }
    });
  }

  openAddBrandModal(): void {
    const dialogRef = this.dialog.open(AddBrandComponent, {
      width: "1240px",
      maxWidth: "96vw",
      height: "90vh",
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

  viewItemModelDetails(itemId: string, variation: any): void {
    const modelId = variation?.model?._id || variation?.model || null;
    if (!modelId) {
      this.viewItemDetails(itemId);
      return;
    }
    this.router.navigate(["/item-details", itemId], {
      queryParams: { model: modelId },
    });
  }

  onSummaryProductsClick(): void {
    this.onClear();
  }

  onSummaryCategoryFilter(): void {
    this.selectedOption = "category";
    this.onFilterModeChange();
  }

  onSummaryBrandFilter(): void {
    this.selectedOption = "brand";
    this.onFilterModeChange();
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
