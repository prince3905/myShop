import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BrandService } from 'app/shared/services/brand.service';

@Component({
  selector: 'add-brand',
  templateUrl: './add-brand.component.html',
  styleUrls: ['./add-brand.component.css']
})
export class AddBrandComponent implements OnInit {

  name: string = "";
  description: string = "";

  constructor(
    private Brand: BrandService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<any>
  ) { }

  ngOnInit(): void {
  }

  onSubmit(): void {
    const formData = {
      name: this.name,
      description: this.description,
    };
    console.log(formData);
    this.Brand.addBrand(formData).subscribe(
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
