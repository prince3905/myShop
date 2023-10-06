import { Component, OnInit } from "@angular/core";
import { MatDialogRef } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { BrandService } from "app/shared/services/brand.service";
import { CategoryService } from "app/shared/services/category.service";

@Component({
  selector: "add-category",
  templateUrl: "./add-category.component.html",
  styleUrls: ["./add-category.component.css"],
})
export class AddCategoryComponent implements OnInit {
  name: string = "";
  description: string = "";
  selectedBrands: string[] = [];
  brands: string[] = [];
  selectedCategoryId: string | null = null; // Initialize with null

  suggestions: string[] = [];
  

  constructor(
    private Category: CategoryService,
    private Brand: BrandService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<any>
  ) {}

  ngOnInit(): void {
    this.Brand.getBrand().subscribe((brands: any[]) => {
      this.brands = brands;
    });
  }

  fetchSuggestions(): void {
    console.log(this.name)
    this.Category.getCategorySuggestion(this.name).subscribe(
      (suggestions: any[]) => {
        this.suggestions = suggestions;
        console.log(this.suggestions);
      },
      (error: any) => {
        console.error("Error fetching suggestions:", error);
      }
    );
  }

  selectSuggestion(suggestion: string): void {
    this.name = suggestion;
    this.suggestions = [];
    console.log(this.name)


  }

  onSubmit(): void {
    const formData = {
      name: this.name,
      description: this.description,
      brands: this.selectedBrands,
    };
  
    this.Category.updateOrCreateCategory(formData).subscribe(
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
        console.error("Error adding/updating category:", error);
        this.snackBar.open("Failed to add/update category.", "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
        this.dialogRef.close();
      }
    );
  }
  

  // onSubmit(): void {
  //   const formData = {
  //     name: this.name,
  //     description: this.description,
  //     brands: this.selectedBrands,
  //   };
  //   console.log(formData);
  //   this.Category.addCategory(formData).subscribe(
  //     (response: any) => {
  //       console.log(response);
  //       this.snackBar.open(response.message, "Close", {
  //         duration: 5000,
  //         horizontalPosition: "center",
  //         verticalPosition: "bottom",
  //       });
  //       this.dialogRef.close();
  //     },
  //     (error: any) => {
  //       console.error("Error adding item:", error);
  //       this.snackBar.open("Failed to add item.", "Close", {
  //         duration: 5000,
  //         horizontalPosition: "center",
  //         verticalPosition: "bottom",
  //       });
  //       this.dialogRef.close();
  //     }
  //   );
  // }


  // 
}
