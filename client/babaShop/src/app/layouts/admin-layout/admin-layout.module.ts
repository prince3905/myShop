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
    MatButtonModule,
    MatFormFieldModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatSelectModule,
    MatInputModule,
    
    
  ],
  declarations: [
    DashboardComponent,
    ItemsListComponent,
    AddItemsComponent,
    UserProfileComponent,
    UserComponent,
    AddUserComponent,
    ItemDetailsComponent,
    
    
  ]
})

export class AdminLayoutModule {}
