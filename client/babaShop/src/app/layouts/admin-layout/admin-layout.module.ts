import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AdminLayoutRoutes } from './admin-layout.routing';
import { DashboardComponent } from '../../dashboard/dashboard.component';
import { UserProfileComponent } from '../../user-profile/user-profile.component';
import {MatButtonModule} from '@angular/material/button';
import {MatRippleModule} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatSelectModule} from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule } from '@angular/material/dialog';
import { ItemsListComponent } from 'app/all-items/items-list/items-list.component';
import { AddItemsComponent } from 'app/all-items/add-items/add-items.component';
import { MatIconModule } from '@angular/material/icon';
import { AddUserComponent } from 'app/all-users/add-user/add-user.component';
import { UserComponent } from 'app/all-users/user/user.component';
import { ItemDetailsComponent } from 'app/all-items/item-details/item-details.component';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import {MatExpansionModule} from '@angular/material/expansion';
import { AddCategoryComponent } from 'app/all-items/add-category/add-category.component';
import { AddBrandComponent } from 'app/all-items/add-brand/add-brand.component';
import { SalesListComponent } from 'app/sales/sales-list/sales-list.component';
import { AddSalesComponent } from 'app/sales/add-sales/add-sales.component';
import {MatDividerModule} from '@angular/material/divider';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatNativeDateModule} from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { StocksComponent } from 'app/stocks/stocks.component';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OrdersComponent } from 'app/orders/orders.component';
import { CustomersComponent } from 'app/customers/customers.component';
import { DistributorsComponent } from 'app/all-distributors/distributors/distributors.component';
import { AddDistributorsComponent } from 'app/all-distributors/add-distributors/add-distributors.component';


@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(AdminLayoutRoutes),
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatRippleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatExpansionModule,
    MatDividerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  declarations: [
    DashboardComponent,
    ItemsListComponent,
    AddItemsComponent,
    UserProfileComponent,
    UserComponent,
    AddUserComponent,
    ItemDetailsComponent,
    AddCategoryComponent,
    AddBrandComponent,
    SalesListComponent,
    AddSalesComponent,
    StocksComponent,
    OrdersComponent,
    CustomersComponent,
    AddDistributorsComponent,
    DistributorsComponent

  ]
})

export class AdminLayoutModule {
  panelOpenState = false;
}
