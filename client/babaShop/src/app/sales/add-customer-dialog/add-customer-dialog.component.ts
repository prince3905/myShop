import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CustomerService } from 'app/shared/services/customer.service';
import { Inject } from '@angular/core';

@Component({
  selector: 'app-add-customer-dialog',
  templateUrl: './add-customer-dialog.component.html',
  styleUrls: ['./add-customer-dialog.component.css']
})
export class AddCustomerDialogComponent implements OnInit {
  customerForm: FormGroup;
  loading: boolean = false;
  isEdit: boolean = false;

  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<AddCustomerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.customerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: ['', [Validators.email]],
      address: ['']
    });
  }

  ngOnInit(): void {
    const customer = this.data?.customer || null;
    if (customer && customer._id) {
      this.isEdit = true;
      this.customerForm.patchValue({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        address: customer.address || ''
      });
    }
  }

  get isEditMode(): boolean {
    return this.isEdit;
  }

  onSubmit(): void {
    if (this.customerForm.invalid) {
      return;
    }

    this.loading = true;
    const customerData = this.customerForm.value;

    const request$ = this.isEditMode
      ? this.customerService.updateCustomer(this.data.customer._id, customerData)
      : this.customerService.createCustomer(customerData);

    request$.subscribe(
      (response: any) => {
        this.loading = false;
        if (response.success) {
          this.snackBar.open(this.isEditMode ? 'Customer updated successfully!' : 'Customer added successfully!', 'Close', {
            duration: 3000
          });
          this.dialogRef.close(response.customer);
        } else {
          this.snackBar.open(response.message || (this.isEditMode ? 'Error updating customer' : 'Error adding customer'), 'Close', {
            duration: 3000
          });
        }
      },
      (error: any) => {
        this.loading = false;
        this.snackBar.open(error?.error?.message || (this.isEditMode ? 'Error updating customer' : 'Error adding customer'), 'Close', {
          duration: 3000
        });
      }
    );
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
