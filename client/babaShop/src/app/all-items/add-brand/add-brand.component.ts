import { Component } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrandService } from "app/shared/services/brand.service";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Inject } from "@angular/core";

@Component({
  selector: "add-brand",
  templateUrl: "./add-brand.component.html",
  styleUrls: ["./add-brand.component.css"],
})
export class AddBrandComponent {
  name: string = "";
  description: string = "";
  isLoading = false;
  isEditMode = false;
  categoryId: string = "";

  constructor(
    private brandService: BrandService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  ngOnInit(): void {
    this.brandService.getAllBrands().subscribe(
      (res: any) => {
        console.log("BRANDS RESPONSE FULL:", res);
        console.log("BRANDS DATA ONLY:", res.data);
      },
      (error) => {
        console.error("BRANDS ERROR:", error);
      },
    );
  }

  onSubmit(): void {
    if (!this.name) {
      this.snackBar.open("Brand name is required", "Close", { duration: 3000 });
      return;
    }

    this.isLoading = true;

    this.brandService
      .addBrand({
        name: this.name,
        description: this.description,
      })
      .subscribe(
        (res: any) => {
          console.log("BRAND CREATED:", res);

          this.snackBar.open(res.message, "Close", { duration: 3000 });
          this.dialogRef.close(true);
        },
        (error) => {
          console.error("BRAND ERROR:", error);

          this.snackBar.open(
            error.error?.message || "Failed to create brand",
            "Close",
            { duration: 3000 },
          );

          this.isLoading = false;
        },
      );
  }
}
