import { Component, Inject, OnInit } from "@angular/core";
import {
  MatDialogRef,
  MatDialog,
  MAT_DIALOG_DATA,
} from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { DistributorService } from "app/shared/services/distributor.service";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { AuthService } from "app/shared/services/auth.service";
import { ShopService } from "app/shared/services/shop.service";

@Component({
  selector: "add-distributors",
  templateUrl: "./add-distributors.component.html",
  styleUrls: ["./add-distributors.component.css"],
})
export class AddDistributorsComponent implements OnInit {
  distributorForm!: FormGroup;
  isEditMode = false;
  distributorId: string;
  isSubmitting = false;
  isSuperAdmin = false;
  shops: any[] = [];
  activeShopId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private distributor: DistributorService,
    private authService: AuthService,
    private shopService: ShopService,
    public dialogRef: MatDialogRef<any>,
    private dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}

  ngOnInit(): void {
    this.distributorForm = this.fb.group({
      name: ["", Validators.required],
      phone: ["", [Validators.required, Validators.pattern("[6-9][0-9]{9}")]],
      telephone: ["", Validators.pattern("[6-9][0-9]{9}")],
      email: ["", Validators.email],
      gstNumber: [""],
      openingBalance: [0],
      creditLimit: [0],
      paymentTerms: [0],
      shop: [""],

      addressLine1: [""],
      addressLine2: [""],
      city: [""],
      district: [""],
      state: [""],
      pincode: [""],
    });

    //  EDIT MODE
    if (this.data && this.data._id) {
      console.log("Edit Mode Activated");

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
        shop:
          this.data?.shop && typeof this.data.shop === "object"
            ? this.data.shop._id
            : this.data?.shop || "",
      });
      //  Disable after patch
      this.distributorForm.get("openingBalance")?.disable();
      this.distributorForm.get("creditLimit")?.disable();
      this.distributorForm.get("paymentTerms")?.disable();
      this.distributorForm.get("shop")?.disable();
    } else {
      console.log("Add Mode Activated");
    }

    this.isSuperAdmin = this.authService.isSuperAdmin();
    this.activeShopId = this.shopService.getSelectedShop();

    if (this.isSuperAdmin) {
      this.loadShops();
      if (this.activeShopId) {
        this.distributorForm.patchValue({ shop: this.activeShopId });
      } else if (!this.isEditMode) {
        this.distributorForm.get("shop")?.setValidators([Validators.required]);
        this.distributorForm.get("shop")?.updateValueAndValidity();
      }
    } else {
      const userShopId = this.authService.getCurrentUser()?.shop || this.activeShopId;
      if (userShopId) {
        this.distributorForm.patchValue({ shop: userShopId });
      }
    }
  }

  loadShops() {
    this.shopService.getAllShops().subscribe({
      next: (res: any) => {
        if (res?.success) {
          const user = this.authService.getCurrentUser();
          const scopedShopId = user?.role === "SUPER_ADMIN" ? user?.shop || null : user?.shop || null;

          if (scopedShopId) {
            this.shops = (res.data || []).filter((shop: any) => shop._id === scopedShopId);
            this.distributorForm.patchValue({ shop: scopedShopId });
          } else {
            this.shops = res.data || [];
          }
        }
      },
      error: () => {
        this.snackBar.open("Unable to load shops", "Close", { duration: 3000 });
      },
    });
  }

  onSubmit() {
    if (this.distributorForm.invalid) {
      console.warn("Form Invalid");
      return;
    }

    const selectedFormShop = this.distributorForm.get("shop")?.value || null;
    const userShop = this.authService.getCurrentUser()?.shop || null;
    const shopId = this.isSuperAdmin
      ? selectedFormShop || this.activeShopId || userShop
      : this.activeShopId || userShop;

    if (!shopId) {
      this.snackBar.open("Shop not selected", "Close", { duration: 3000 });
      return;
    }

    this.isSubmitting = true;

    const payload = {
      shop: shopId,
      name: this.distributorForm.value.name,
      phone: this.distributorForm.value.phone,
      telephone: this.distributorForm.value.telephone,
      email: this.distributorForm.value.email,
      gstNumber: this.distributorForm.value.gstNumber,
      // 🔥 Only include in ADD
      ...(this.isEditMode
        ? {}
        : {
            openingBalance: this.distributorForm.value.openingBalance,
            creditLimit: this.distributorForm.value.creditLimit,
            paymentTerms: this.distributorForm.value.paymentTerms,
          }),
      address: {
        addressLine1: this.distributorForm.value.addressLine1,
        addressLine2: this.distributorForm.value.addressLine2,
        city: this.distributorForm.value.city,
        district: this.distributorForm.value.district,
        state: this.distributorForm.value.state,
        pincode: this.distributorForm.value.pincode,
      },
    };

    console.log("Payload:", payload);

    if (this.isEditMode) {
      // 🔥 UPDATE API
      this.distributor
        .updateDistributor(this.distributorId, payload)
        .subscribe({
          next: (res: any) => {
            console.log("Update Success:", res);

            this.snackBar.open(
              res?.message || "Distributor updated successfully",
              "Close",
              { duration: 3000 },
            );

            this.dialogRef.close(true);
          },
          error: (err) => {
            console.error("Update Error:", err);

            this.snackBar.open(
              err?.error?.message || "Error updating distributor",
              "Close",
              { duration: 3000 },
            );

            this.isSubmitting = false;
          },
        });
    } else {
      // 🔥 ADD API
      this.distributor.addDistributor(payload).subscribe({
        next: (res: any) => {
          console.log("Add Success:", res);

          this.snackBar.open(
            res?.message || "Distributor added successfully",
            "Close",
            { duration: 3000 },
          );

          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error("Add Error:", err);

          this.snackBar.open(
            err?.error?.message || "Error adding distributor",
            "Close",
            { duration: 3000 },
          );

          this.isSubmitting = false;
        },
      });
    }
  }
}
