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
import { CreateOrderComponent } from "app/orders/create-order.component";
import { OrderDetailsComponent } from "app/orders/order-details.component";
import { CustomersComponent } from "app/customers/customers.component";
import { AddDetailsComponent } from "app/all-items/add-details/add-details.component";
import { SettingsComponent } from "app/settings/settings.component";
import { UserComponent } from "app/all-users/user/user.component";
import { ManageShopsComponent } from "app/shops/manage-shops/manage-shops.component";
import { RoleGuard } from "app/shared/guard/role.guard";
import { PurchaseConsoleComponent } from "app/purchases/purchase-console/purchase-console.component";
import { PosComponent } from "app/sales/pos/pos.component";
import { ReturnsComponent } from "app/sales/returns/returns.component";
import { SalesReportsComponent } from "app/sales/sales-reports/sales-reports.component";
import { CustomerDetailsComponent } from "app/customers/customer-details/customer-details.component";
import { DailyExpenseComponent } from "app/expenses/daily-expense/daily-expense.component";
import { StaffMasterComponent } from "app/staff/staff-master/staff-master.component";
import { StaffPaymentsComponent } from "app/staff/staff-payments/staff-payments.component";
import { FactoryProductionComponent } from "app/factory/factory-production/factory-production.component";
import { RawMaterialRegisterComponent } from "app/factory/raw-material-register/raw-material-register.component";

const ALL_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"];
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const ADMIN_AND_ABOVE = ["SUPER_ADMIN", "ADMIN"];

export const AdminLayoutRoutes: Routes = [
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [SecurePageGuardGuard, RoleGuard],
    data: { roles: ALL_ROLES },
  },
  { path: "login", component: LoginComponent },
  { path: "profile", component: UserProfileComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES } },
  { path: "user-profile", component: UserProfileComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES } },
  { path: "item-list", component: ItemsListComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, allowGlobalRead: true } },
  { path: "add-items", component: AddItemsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true } },
  { path: "add-items/:id", component: AddItemsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true } },
  { path: "add-detail/:productId", component: AddDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, requireShop: true } },
  { path: "add-detail/:productId/:id", component: AddDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, requireShop: true } },
  { path: "item-details/:id", component: ItemDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, allowGlobalRead: true } },
  { path: "sale-list", component: SalesListComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, allowGlobalRead: true } },
  { path: "sales-reports", component: SalesReportsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES } },
  { path: "pos", component: PosComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true } },
  { path: "returns", component: ReturnsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true } },
  { path: "stocks", component: StocksComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, allowGlobalRead: true } },
  { path: "purchase", component: PurchaseConsoleComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, requireShop: true, allowGlobalRead: true } },
  { path: "distributor", component: DistributorsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, requireShop: true, allowGlobalRead: true } },
  { path: "order", component: OrdersComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, allowGlobalRead: true } },
  { path: "order/create", component: CreateOrderComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true } },
  { path: "order/edit/:id", component: CreateOrderComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true } },
  { path: "order/:id", component: OrderDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, allowGlobalRead: true } },
  { path: "customer", component: CustomersComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, allowGlobalRead: true } },
  { path: "customer/:id", component: CustomerDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, allowGlobalRead: true } },
  { path: "daily-expense", component: DailyExpenseComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true } },
  { path: "staff-master", component: StaffMasterComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true } },
  { path: "staff-payments", component: StaffPaymentsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true } },
  { path: "factory-production", component: FactoryProductionComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true } },
  { path: "raw-material-register", component: RawMaterialRegisterComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true } },
  { path: "users", component: UserComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE } },
  { path: "shops", component: ManageShopsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN"] } },
  { path: "settings", component: SettingsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE } },
];
