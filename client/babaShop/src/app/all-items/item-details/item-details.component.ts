import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ProductService } from "app/shared/services/product.service";
import { MatDialog } from "@angular/material/dialog";
import { AddItemsComponent } from "../add-items/add-items.component";

@Component({
  selector: "app-item-details",
  templateUrl: "./item-details.component.html",
  styleUrls: ["./item-details.component.css"],
})
export class ItemDetailsComponent implements OnInit {
  item: any = null;
  loading = false;
  errorMessage = "";

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
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

        this.loading = false;
      },
      error: (error: any) => {
        console.error("[FLOW][ITEM_DETAILS][LOAD] error", error);
        this.item = null;
        this.errorMessage = error?.error?.message || "Unable to load product details.";
        this.loading = false;
      },
    });
  }

  openEditProduct(item: any) {
    const dialogRef = this.dialog.open(AddItemsComponent, {
      width: "500px",
      data: { product: item },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.fetchItemDetails(item._id); // 🔥 reload updated data
      }
    });
  }
}
