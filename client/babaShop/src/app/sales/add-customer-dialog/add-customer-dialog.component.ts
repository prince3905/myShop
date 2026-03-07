import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CustomerService } from 'app/shared/services/customer.service';

@Component({
  selector: 'app-add-customer-dialog',
  templateUrl: './add-customer-dialog.component.html',
  styleUrls: ['./add-customer-dialog.component.css']
})
export class AddCustomerDialogComponent implements OnInit {
  customerForm: FormGroup;
  loading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<AddCustomerDialogComponent>
  ) {
    this.customerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: ['', [Validators.email]],
      address: ['']
    });
  }

  ngOnInit(): void {}

  onSubmit(): void {
    if (this.customerForm.invalid) {
      return;
    }

    this.loading = true;
    const customerData = this.customerForm.value;

    this.customerService.createCustomer(customerData).subscribe(
      (response: any) => {
        this.loading = false;
        if (response.success) {
          this.snackBar.open('Customer added successfully!', 'Close', {
            duration: 3000
          });
          this.dialogRef.close(response.customer);
        } else {
          this.snackBar.open(response.message || 'Error adding customer', 'Close', {
            duration: 3000
          });
        }
      },
      (error: any) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || 'Error adding customer', 'Close', {
          duration: 3000
        });
      }
    );
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

