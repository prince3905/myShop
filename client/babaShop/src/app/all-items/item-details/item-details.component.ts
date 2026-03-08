import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ProductService } from "app/shared/services/product.service";
import { MatDialog } from "@angular/material/dialog";
import { AddItemsComponent } from "../add-items/add-items.component";
import { Router } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { AuthService } from "app/shared/services/auth.service";
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from "app/shared/components/confirm-dialog/confirm-dialog.component";

@Component({
  selector: "app-item-details",
  templateUrl: "./item-details.component.html",
  styleUrls: ["./item-details.component.css"],
})
export class ItemDetailsComponent implements OnInit {
  item: any = null;
  filteredVariations: any[] = [];
  selectedModelId: string | null = null;
  selectedModelName: string | null = null;
  loading = false;
  errorMessage = "";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    public authService: AuthService,
    private snackBar: MatSnackBar,
    public dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get("id");
      if (!id) {
        this.item = null;
        this.errorMessage = "Invalid product id.";
        return;
      }
      this.fetchItemDetails(id);
    });

    this.route.queryParamMap.subscribe((query) => {
      this.selectedModelId = query.get("model");
      this.applyVariationFilter();
    });
  }

  fetchItemDetails(id: string) {
    this.loading = true;
    this.errorMessage = "";

    this.productService.getProductById(id).subscribe({
      next: (res: any) => {
        const product = res?.data || res;

        if (!product?._id) {
          this.item = null;
          this.errorMessage = "Product not found.";
          this.loading = false;
          return;
        }

        this.item = product;
        this.item.totalStock =
          this.item.variations?.reduce(
            (sum: number, v: any) => sum + (v.quantity || 0),
            0,
          ) || 0;
        this.applyVariationFilter();

        this.loading = false;
      },
      error: (error: any) => {
        this.item = null;
        this.errorMessage = error?.error?.message || "Unable to load product details.";
        this.loading = false;
      },
    });
  }

  openEditProduct(item: any) {
    const dialogRef = this.dialog.open(AddItemsComponent, {
      width: "820px",
      maxWidth: "94vw",
      data: { product: item },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.fetchItemDetails(item._id);
      }
    });
  }

  openVariationConsole(item: any, variation?: any) {
    if (!item?._id) return;
    if (variation?._id) {
      this.router.navigate(["/add-detail", item._id, variation._id]);
      return;
    }
    this.router.navigate(["/add-detail", item._id]);
  }

  clearModelFilter(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { model: null },
      queryParamsHandling: "merge",
    });
  }

  deleteProduct(item: any): void {
    const id = item?._id;
    if (!id) return;

    const confirmData: ConfirmDialogData = {
      mode: "confirm",
      title: "Delete Product",
      message: `Delete product "${item?.name || "this product"}"? This will also remove models and variations.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    };

    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: "460px",
      maxWidth: "95vw",
      data: confirmData,
      disableClose: true,
    });

    ref.afterClosed().subscribe((ok: boolean) => {
      if (!ok) return;

      this.productService.deleteProduct(id).subscribe({
        next: (res: any) => {
          this.snackBar.open(res?.message || "Product deleted", "Close", {
            duration: 2500,
          });
          this.router.navigate(["/item-list"]);
        },
        error: (error: any) => {
          const msg = this.getDeleteProductErrorMessage(error);
          this.snackBar.open(msg, "Close", {
            duration: 4200,
          });

          if (Number(error?.status || 0) === 409) {
            this.dialog.open(ConfirmDialogComponent, {
              width: "460px",
              maxWidth: "95vw",
              data: {
                mode: "info",
                title: "Delete Blocked",
                message: "This product is used in transactions. Please deactivate instead of deleting.",
                usage: error?.error?.usage || {},
              } as ConfirmDialogData,
            });
          }
        },
      });
    });
  }

  private getDeleteProductErrorMessage(error: any): string {
    const status = Number(error?.status || 0);
    const usage = error?.error?.usage || {};
    if (status === 409) {
      const saleCount = Number(usage?.saleCount || 0);
      const orderCount = Number(usage?.orderCount || 0);
      const purchaseCount = Number(usage?.purchaseCount || 0);
      return `Cannot delete: used in Sale(${saleCount}), Order(${orderCount}), Purchase(${purchaseCount}). Deactivate instead.`;
    }

    return error?.error?.message || "Failed to delete product";
  }

  private applyVariationFilter(): void {
    const all = Array.isArray(this.item?.variations) ? this.item.variations : [];
    if (!this.selectedModelId) {
      this.filteredVariations = all;
      this.selectedModelName = null;
      return;
    }

    this.filteredVariations = all.filter((v: any) => {
      const mid = v?.model?._id || v?.model || "";
      return `${mid}` === `${this.selectedModelId}`;
    });
    const first = this.filteredVariations[0];
    this.selectedModelName = first?.model?.name || null;
  }
}
