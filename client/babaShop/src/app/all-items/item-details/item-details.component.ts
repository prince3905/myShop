import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ProductService } from "app/shared/services/product.service";
import { MatDialog } from "@angular/material/dialog";
import { AddItemsComponent } from "../add-items/add-items.component";

@Component({
  selector: "app-item-details",
  templateUrl: "./item-details.component.html",
})
export class ItemDetailsComponent implements OnInit {
  item: any;

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private router: Router,
    public dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get("id");
    if (id) {
      this.fetchItemDetails(id);
    }
  }

  fetchItemDetails(id: string) {
    this.productService.getProductById(id).subscribe((res: any) => {
      this.item = res.data;

      // Calculate total stock from variations
      this.item.totalStock =
        this.item.variations?.reduce(
          (sum: number, v: any) => sum + (v.quantity || 0),
          0,
        ) || 0;

      console.log("Product Details:", this.item);
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
