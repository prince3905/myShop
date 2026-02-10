import { Component, Inject, OnInit } from "@angular/core";
import {
  MatDialogRef,
  MatDialog,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { DistributorService } from "app/shared/services/distributor.service";
import { FormControl, Validators } from "@angular/forms";

@Component({
  selector: "add-distributors",
  templateUrl: "./add-distributors.component.html",
  styleUrls: ["./add-distributors.component.css"],
})
export class AddDistributorsComponent implements OnInit {
  name: string = "";
  shopName: string = "";
  email: string = "";
  phone: string = "";
  telephone: string = "";
  address: string = "";
  city: string = "";
  state: string = "";

  isEditMode = false;
  distributorId: string;

  constructor(
    private snackBar: MatSnackBar,
    private distributors: DistributorService,
    public dialogRef: MatDialogRef<any>,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    if (this.data && this.data._id) {
      this.isEditMode = true;
      this.distributorId = this.data._id;
  
      this.name = this.data.name;
      this.shopName = this.data.shopName;
      this.email = this.data.email;
      this.phone = this.data.phone;
      this.telephone = this.data.telephone;
      this.address = this.data.address;
      this.city = this.data.city;
      this.state = this.data.state;
    }
  }

  

  onSubmit() {
    const formData = {
      name: this.name,
      shopName: this.shopName,
      email: this.email,
      phone: this.phone,
      telephone: this.telephone,
      address: this.address,
      city: this.city,
      state: this.state,
    };
    console.log("Submitted Distributor Data:", formData);



    if (this.isEditMode) {
      // 🔥 UPDATE
      this.distributors.updateDistributor(this.distributorId, formData)
        .subscribe(
          (res: any) => {
            this.snackBar.open('Distributor updated successfully', 'Close', {
              duration: 3000,
            });
            this.dialogRef.close(true);
          },
          () => {
            this.snackBar.open('Update failed', 'Close', { duration: 3000 });
          }
        );
    } else {
      // ➕ ADD
      this.distributors.AddDistributor(formData)
        .subscribe(
          (res: any) => {
            this.snackBar.open('Distributor added successfully', 'Close', {
              duration: 3000,
            });
            this.dialogRef.close(true);
          },
          () => {
            this.snackBar.open('Add failed', 'Close', { duration: 3000 });
          }
        );
    }





    this.distributors.AddDistributor(formData).subscribe(
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
        console.error("Error adding Distributor:", error);
        this.snackBar.open("Failed to add Distributor.", "Close", {
          duration: 5000,
          horizontalPosition: "center",
          verticalPosition: "bottom",
        });
        this.dialogRef.close();
      }
    );
  }
}
