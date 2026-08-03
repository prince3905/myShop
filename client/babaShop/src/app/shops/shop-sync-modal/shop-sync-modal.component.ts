import { Component, Inject, OnInit } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { ShopService } from "app/shared/services/shop.service";

@Component({
  selector: "app-shop-sync-modal",
  templateUrl: "./shop-sync-modal.component.html",
  styleUrls: ["./shop-sync-modal.component.css"],
})
export class ShopSyncModalComponent implements OnInit {
  shops: any[] = [];
  sourceShopId: string = "";
  targetShopId: string = "";

  includeCategories: boolean = true;
  includeBrands: boolean = true;
  includeProducts: boolean = true;
  includeDistributors: boolean = true;

  isLoadingShops = false;
  isSubmitting = false;
  syncStats: any = null;

  constructor(
    private shopService: ShopService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ShopSyncModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    this.loadShops();
  }

  loadShops(): void {
    this.isLoadingShops = true;
    this.shopService.getAllShops().subscribe({
      next: (res: any) => {
        this.isLoadingShops = false;
        if (res?.success) {
          this.shops = res.data || [];
          if (this.shops.length >= 2) {
            this.sourceShopId = this.shops[0]._id;
            this.targetShopId = this.shops[1]._id;
          }
        }
      },
      error: () => {
        this.isLoadingShops = false;
        this.snackBar.open("Failed to load shop list", "Close", { duration: 3000 });
      },
    });
  }

  onStartSync(): void {
    if (!this.sourceShopId || !this.targetShopId) {
      this.snackBar.open("Please select both Source and Target shops", "Close", { duration: 3000 });
      return;
    }

    if (this.sourceShopId === this.targetShopId) {
      this.snackBar.open("Source and Target shops must be different", "Close", { duration: 3000 });
      return;
    }

    if (
      !this.includeCategories &&
      !this.includeBrands &&
      !this.includeProducts &&
      !this.includeDistributors
    ) {
      this.snackBar.open("Please select at least one item type to clone", "Close", { duration: 3000 });
      return;
    }

    this.isSubmitting = true;
    this.syncStats = null;

    const payload = {
      sourceShopId: this.sourceShopId,
      targetShopId: this.targetShopId,
      includeCategories: this.includeCategories,
      includeBrands: this.includeBrands,
      includeProducts: this.includeProducts,
      includeDistributors: this.includeDistributors,
    };

    this.shopService.cloneShopData(payload).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        if (res?.success) {
          this.syncStats = res.stats;
          this.snackBar.open(
            res.message || "Data copied successfully!",
            "Success",
            { duration: 4000 }
          );
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.snackBar.open(
          err?.error?.message || "Failed to copy shop data",
          "Close",
          { duration: 4000 }
        );
      },
    });
  }

  getSourceShopName(): string {
    const s = this.shops.find((x) => x._id === this.sourceShopId);
    return s ? s.name : "Source Shop";
  }

  getTargetShopName(): string {
    const t = this.shops.find((x) => x._id === this.targetShopId);
    return t ? t.name : "Target Shop";
  }

  onClose(): void {
    this.dialogRef.close(this.syncStats ? true : false);
  }
}
