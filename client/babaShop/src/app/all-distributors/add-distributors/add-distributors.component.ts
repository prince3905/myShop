import { Component, OnInit } from "@angular/core";
import { MatDialogRef, MatDialog } from "@angular/material/dialog";
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

  constructor(
    private snackBar: MatSnackBar,
    private distributors: DistributorService,
    public dialogRef: MatDialogRef<any>,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {}

  onSubmit() {
    const formData = {
      name: this.name,
      shopName: this.shopName,
      email: this.email,
      phone: this.phone,
      telephone: this.telephone,
      address: this.address,
    };
    console.log("Submitted Distributor Data:", formData);
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
