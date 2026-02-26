import { Component, OnInit } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { CategoryService } from "app/shared/services/category.service";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Inject } from "@angular/core";

@Component({
  selector: "add-category",
  templateUrl: "./add-category.component.html",
  styleUrls: ["./add-category.component.css"],
})
export class AddCategoryComponent {
  name: string = "";
  description: string = "";
  isLoading = false;
  isEditMode = false;
  categoryId: string = "";

  constructor(
    private Category: CategoryService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<any>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  ngOnInit(): void {
    if (this.data?.category) {
      this.isEditMode = true;
      this.categoryId = this.data.category._id;
      this.name = this.data.category.name;
      this.description = this.data.category.description;
    }

    console.log("Selected Shop:", localStorage.getItem("selected_shop"));

    this.Category.getAllCategories().subscribe(
      (res: any) => {
        console.log("CATEGORIES RESPONSE FULL:", res);
        console.log("CATEGORIES DATA ONLY:", res.data);
      },
      (error) => {
        console.error("CATEGORY ERROR:", error);
      },
    );
  }

  onSubmit(): void {
    if (!this.name) {
      this.snackBar.open("⚠ Category name is required", "Close", {
        duration: 3000,
        panelClass: ["snackbar-error"],
      });
      return;
    }

    this.isLoading = true;

    const payload = {
      name: this.name,
      description: this.description,
    };

    if (this.isEditMode) {
      this.Category.updateCategory(this.categoryId, payload).subscribe({
        next: (res: any) => {
          this.snackBar.open("✅ Category updated successfully", "Close", {
            duration: 3000,
            panelClass: ["snackbar-success"],
          });
          this.dialogRef.close(true);
        },

        error: (err) => {
          this.isLoading = false;
          this.snackBar.open(
            err.error?.message || "❌ Failed to update category",
            "Close",
            { duration: 3000, panelClass: ["snackbar-error"] },
          );
        },
      });
    } else {
      this.Category.addCategory(payload).subscribe({
        next: (res: any) => {
          this.snackBar.open("✅ Category created successfully", "Close", {
            duration: 3000,
            panelClass: ["snackbar-success"],
          });
          this.dialogRef.close(true);
        },

        error: (err) => {
          this.isLoading = false;
          this.snackBar.open(
            err.error?.message || "❌ Failed to create category",
            "Close",
            { duration: 3000, panelClass: ["snackbar-error"] },
          );
        },
      });
    }
  }
}
