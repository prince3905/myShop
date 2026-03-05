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
import { RoleGuard } from "app/shared/guard/role.guard";
import { PurchaseConsoleComponent } from "app/purchases/purchase-console/purchase-console.component";

export const AdminLayoutRoutes: Routes = [
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [SecurePageGuardGuard, RoleGuard],
    data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"] },
  },
  { path: "login", component: LoginComponent },
  { path: "profile", component: UserProfileComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"] } },
  { path: "user-profile", component: UserProfileComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"] } },
  { path: "item-list", component: ItemsListComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"] } },
  { path: "add-items", component: AddItemsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] } },
  { path: "add-items/:id", component: AddItemsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] } },
  { path: "add-detail/:productId", component: AddDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] } },
  { path: "add-detail/:productId/:id", component: AddDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] } },
  { path: "item-details/:id", component: ItemDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"] } },
  { path: "sale-list", component: SalesListComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"] } },
  { path: "stocks", component: StocksComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"] } },
  { path: "purchase", component: PurchaseConsoleComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] } },
  { path: "distributor", component: DistributorsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN"] } },
  { path: "order", component: OrdersComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] } },
  { path: "customer", component: CustomersComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"] } },
  { path: "users", component: UserComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] } },
  { path: "shops", component: ManageShopsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN"] } },
  { path: "settings", component: SettingsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN", "ADMIN"] } },
];
