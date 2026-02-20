import { Component, Inject, OnInit } from "@angular/core";
import {
  MatDialogRef,
  MatDialog,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { DistributorService } from "app/shared/services/distributor.service";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";

@Component({
  selector: "add-distributors",
  templateUrl: "./add-distributors.component.html",
  styleUrls: ["./add-distributors.component.css"],
})
export class AddDistributorsComponent implements OnInit {
  distributorForm!: FormGroup; 
  isEditMode = false;
  distributorId: string;

  constructor(
     private fb: FormBuilder, 
    private snackBar: MatSnackBar,
    private distributor: DistributorService,
    public dialogRef: MatDialogRef<any>,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {

  this.distributorForm = this.fb.group({
    name: ['', Validators.required],
    phone: ['', Validators.required],
    telephone: ['', Validators.pattern('[6-9][0-9]{9}')],
    email: ['', [Validators.email]],
    gstNumber: [''],

    addressLine1: [''],
    addressLine2: [''],
    city: [''],
    district: [''],
    state: [''],
    pincode: ['']
  });

  // 🔥 EDIT MODE CHECK
  if (this.data) {
    this.isEditMode = true;
    this.distributorId = this.data._id;

    this.distributorForm.patchValue({
      name: this.data.name,
      phone: this.data.phone,
      telephone: this.data.telephone,
      email: this.data.email,
      gstNumber: this.data.gstNumber,
      addressLine1: this.data.address?.addressLine1,
      addressLine2: this.data.address?.addressLine2,
      city: this.data.address?.city,
      district: this.data.address?.district,
      state: this.data.address?.state,
      pincode: this.data.address?.pincode,
    });
  }
}

onSubmit() {

  if (this.distributorForm.invalid) return;

  const payload = {
    name: this.distributorForm.value.name,
    phone: this.distributorForm.value.phone,
    telephone: this.distributorForm.value.telephone,
    gstNumber: this.distributorForm.value.gstNumber,
    address: {
      addressLine1: this.distributorForm.value.addressLine1,
      addressLine2: this.distributorForm.value.addressLine2,
      city: this.distributorForm.value.city,
      district: this.distributorForm.value.district,
      state: this.distributorForm.value.state,
      pincode: this.distributorForm.value.pincode,
    }
  };

  if (this.isEditMode) {
    this.distributor.updateDistributor(this.distributorId, payload)
      .subscribe(() => {
        this.dialogRef.close(true);
      });
  } else {
    this.distributor.AddDistributor(payload)
      .subscribe(() => {
        this.dialogRef.close(true);
      });
  }
}
}
