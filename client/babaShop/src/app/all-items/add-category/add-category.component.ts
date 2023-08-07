import { Component, OnInit } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { CategoryService } from "app/shared/services/category.service";

@Component({
  selector: "add-category",
  templateUrl: "./add-category.component.html",
  styleUrls: ["./add-category.component.css"],
})
export class AddCategoryComponent implements OnInit {
  name: string = "";
  description: string = "";

  constructor(
    private Category: CategoryService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<any>
  ) {}

  ngOnInit(): void {}

  onSubmit(): void {
    const formData = {
      name: this.name,
      description: this.description,
    };
    console.log(formData);
    this.Category.addCategory(formData).subscribe(
      (response: any) => {
        console.log(response);
        this.snackBar.open(response.message, "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
        this.dialogRef.close();
      },
      (error: any) => {
        console.error("Error adding item:", error);
        this.snackBar.open("Failed to add item.", "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
        this.dialogRef.close();
      }
    );
  }
}
