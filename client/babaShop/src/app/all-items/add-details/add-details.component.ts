import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
// import { VariationService } from '../../shared/services/';
import { ItemService } from '../../shared/services/item.service';

@Component({
  selector: 'app-add-detail',
  templateUrl: './add-details.component.html',
  styleUrls: ['./add-details.component.css']
})
export class AddDetailsComponent implements OnInit {

  productId!: string;
  variationId!: string | null;
  product: any;

  isEditMode = false;
  isLoading = false;

  variation: any = {
    model: '',
    sku: '',
    color: '',
    size: '',
    costPrice: 0,
    sellingPrice: 0,
    quantity: 0
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    // private variationService: VariationService,
    private itemService: ItemService
  ) {}

  ngOnInit(): void {

    this.productId = this.route.snapshot.paramMap.get('productId')!;
    this.variationId = this.route.snapshot.paramMap.get('id');

    if (this.variationId) {
      this.isEditMode = true;
      // this.loadVariation(this.variationId);
    }

    // this.loadProduct();
  }

  // loadProduct() {
  //   this.itemService.getItemById(this.productId).subscribe((res: any) => {
  //     this.product = res.data;
  //   });
  // }

  // loadVariation(id: string) {
  //   this.variationService.getVariationById(id)
  //     .subscribe((res: any) => {
  //       this.variation = res.data;
  //     });
  // }

  // saveVariation() {

  //   if (!this.variation.sku) {
  //     this.snackBar.open('SKU is required', 'Close', { duration: 3000 });
  //     return;
  //   }

  //   this.isLoading = true;

  //   const payload = {
  //     ...this.variation,
  //     product: this.productId
  //   };

  //   if (this.isEditMode) {

  //     this.variationService.updateVariation(this.variationId!, payload)
  //       .subscribe(() => {
  //         this.snackBar.open('Variation Updated', 'Close', { duration: 3000 });
  //         this.router.navigate(['/all-items/item-list']);
  //       });

  //   } else {

  //     this.variationService.addVariation(payload)
  //       .subscribe(() => {
  //         this.snackBar.open('Variation Added', 'Close', { duration: 3000 });

  //         this.variation = {
  //           model: '',
  //           sku: '',
  //           color: '',
  //           size: '',
  //           costPrice: 0,
  //           sellingPrice: 0,
  //           quantity: 0
  //         };

  //         this.isLoading = false;
  //       });

  //   }

  // }

}