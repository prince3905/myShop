import { Routes } from "@angular/router";

import { DashboardComponent } from "../../dashboard/dashboard.component";
import { UserProfileComponent } from "../../user-profile/user-profile.component";
// import { TableListComponent } from '../../item-list/table-list.component';
// import { TypographyComponent } from '../../typography/typography.component';
// import { IconsComponent } from '../../icons/icons.component';
// import { MapsComponent } from '../../maps/maps.component';
// import { NotificationsComponent } from '../../notifications/notifications.component';
// import { UpgradeComponent } from '../../upgrade/upgrade.component';
import { SecurePageGuardGuard } from "app/shared/guard/secure-page-guard.guard";
import { LoginComponent } from "app/login/login.component";
import { ItemsListComponent } from "app/all-items/items-list/items-list.component";
import { AddItemsComponent } from "app/all-items/add-items/add-items.component";
import { ItemDetailsComponent } from "app/all-items/item-details/item-details.component";
import { AddSalesComponent } from "app/sales/add-sales/add-sales.component";
import { SalesListComponent } from "app/sales/sales-list/sales-list.component";
import { StocksComponent } from "app/stocks/stocks.component";
import { DistributorsComponent } from "app/all-distributors/distributors/distributors.component";
import { OrdersComponent } from "app/orders/orders.component";
import { CustomersComponent } from "app/customers/customers.component";

export const AdminLayoutRoutes: Routes = [
  // {
  //   path: '',
  //   children: [ {
  //     path: 'dashboard',
  //     component: DashboardComponent
  // }]}, {
  // path: '',
  // children: [ {
  //   path: 'userprofile',
  //   component: UserProfileComponent
  // }]
  // }, {
  //   path: '',
  //   children: [ {
  //     path: 'icons',
  //     component: IconsComponent
  //     }]
  // }, {
  //     path: '',
  //     children: [ {
  //         path: 'notifications',
  //         component: NotificationsComponent
  //     }]
  // }, {
  //     path: '',
  //     children: [ {
  //         path: 'maps',
  //         component: MapsComponent
  //     }]
  // }, {
  //     path: '',
  //     children: [ {
  //         path: 'typography',
  //         component: TypographyComponent
  //     }]
  // }, {
  //     path: '',
  //     children: [ {
  //         path: 'upgrade',
  //         component: UpgradeComponent
  //     }]
  // }
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [SecurePageGuardGuard],
  },
  { path: "login", component: LoginComponent },
  { path: "user-profile", component: UserProfileComponent },
  { path: "item-list", component: ItemsListComponent },
  { path: "add-items", component: AddItemsComponent },
  { path: "item-details/:id", component: ItemDetailsComponent },
  { path: "item-details/:name/:category/:brand", component: ItemDetailsComponent },
  { path: "sale-list", component: SalesListComponent },
  { path: "stocks", component: StocksComponent },
  { path: "distributor", component: DistributorsComponent },
  { path: "order", component: OrdersComponent },
  { path: "customer", component: CustomersComponent },

  // { path: 'table-list',     component: TableListComponent },
  // { path: 'typography',     component: TypographyComponent },
  // { path: 'icons',          component: IconsComponent },
  // { path: 'maps',           component: MapsComponent },
  // { path: 'notifications',  component: NotificationsComponent },
  // { path: 'upgrade',        component: UpgradeComponent },
];
