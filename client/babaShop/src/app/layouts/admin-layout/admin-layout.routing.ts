import { Routes } from "@angular/router";

import { DashboardComponent } from "../../dashboard/dashboard.component";
import { UserProfileComponent } from "../../user-profile/user-profile.component";
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
import { AddDetailsComponent } from "app/all-items/add-details/add-details.component";
import { SettingsComponent } from "app/settings/settings.component";
import { UserComponent } from "app/all-users/user/user.component";
import { ManageShopsComponent } from "app/shops/manage-shops/manage-shops.component";

export const AdminLayoutRoutes: Routes = [
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [SecurePageGuardGuard],
  },
  { path: "login", component: LoginComponent },
  { path: "profile", component: UserProfileComponent },
  { path: "user-profile", component: UserProfileComponent },
  { path: "item-list", component: ItemsListComponent },
  { path: "add-items", component: AddItemsComponent },
  { path: "add-items/:id", component: AddItemsComponent },
  { path: "add-detail/:productId", component: AddDetailsComponent },
  { path: "add-detail/:productId/:id", component: AddDetailsComponent },
  { path: "item-details/:id", component: ItemDetailsComponent },
  { path: "sale-list", component: SalesListComponent },
  { path: "stocks", component: StocksComponent },
  { path: "distributor", component: DistributorsComponent },
  { path: "order", component: OrdersComponent },
  { path: "customer", component: CustomersComponent },
  { path: "users", component: UserComponent },
  { path: "shops", component: ManageShopsComponent },
  { path: "settings", component: SettingsComponent },
];
