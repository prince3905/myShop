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
import { ExpenseReportComponent } from "app/expenses/expense-report/expense-report.component";
import { StaffMasterComponent } from "app/staff/staff-master/staff-master.component";
import { StaffPaymentsComponent } from "app/staff/staff-payments/staff-payments.component";
import { StaffDailyWorkComponent } from "app/staff/staff-daily-work/staff-daily-work.component";
import { StaffPayableSummaryComponent } from "app/staff/staff-payable-summary/staff-payable-summary.component";
import { StaffWorkItemsComponent } from "app/staff/staff-work-items/staff-work-items.component";
import { FactoryProductMasterComponent } from "app/factory/factory-product-master/factory-product-master.component";
import { FactoryVerificationComponent } from "app/factory/factory-verification/factory-verification.component";
import { RawMaterialPurchaseComponent } from "app/factory/raw-material-purchase/raw-material-purchase.component";
import { RawMaterialRegisterComponent } from "app/factory/raw-material-register/raw-material-register.component";
import { FactoryReportComponent } from "app/factory/factory-report/factory-report.component";

const ALL_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"];
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];
const ADMIN_AND_ABOVE = ["SUPER_ADMIN", "ADMIN"];

export const AdminLayoutRoutes: Routes = [
  {
    path: "dashboard",
    component: DashboardComponent,
    canActivate: [SecurePageGuardGuard, RoleGuard],
    data: { roles: ALL_ROLES, feature: "dashboard.basic" },
  },
  { path: "login", component: LoginComponent },
  { path: "profile", component: UserProfileComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, feature: "settings.profile" } },
  { path: "user-profile", component: UserProfileComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, feature: "settings.profile" } },
  { path: "item-list", component: ItemsListComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, allowGlobalRead: true, feature: "inventory.products" } },
  { path: "add-items", component: AddItemsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "inventory.products" } },
  { path: "add-items/:id", component: AddItemsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "inventory.products" } },
  { path: "add-detail/:productId", component: AddDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, requireShop: true, feature: "inventory.product_details" } },
  { path: "add-detail/:productId/:id", component: AddDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, requireShop: true, feature: "inventory.product_details" } },
  { path: "item-details/:id", component: ItemDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, allowGlobalRead: true, feature: "inventory.product_details" } },
  { path: "sale-list", component: SalesListComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, allowGlobalRead: true, feature: "sales.list" } },
  { path: "sales-reports", component: SalesReportsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, feature: "sales.profit" } },
  { path: "pos", component: PosComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "sales.pos" } },
  { path: "returns", component: ReturnsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "sales.return" } },
  { path: "stocks", component: StocksComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, allowGlobalRead: true, feature: "inventory.stocks" } },
  { path: "purchase", component: PurchaseConsoleComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, requireShop: true, allowGlobalRead: true, feature: "inventory.purchase" } },
  { path: "distributor", component: DistributorsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, requireShop: true, allowGlobalRead: true, feature: "people.distributors" } },
  { path: "order", component: OrdersComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, allowGlobalRead: true, feature: "sales.orders" } },
  { path: "order/create", component: CreateOrderComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "sales.orders" } },
  { path: "order/edit/:id", component: CreateOrderComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "sales.orders" } },
  { path: "order/:id", component: OrderDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, allowGlobalRead: true, feature: "sales.orders" } },
  { path: "customer", component: CustomersComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, allowGlobalRead: true, feature: "people.customers" } },
  { path: "customer/:id", component: CustomerDetailsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, allowGlobalRead: true, feature: "people.customers" } },
  { path: "daily-expense", component: DailyExpenseComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true } },
  { path: "expense-report", component: ExpenseReportComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "expenses.report" } },
  { path: "staff-master", component: StaffMasterComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "staff.master" } },
  { path: "staff-work-items", component: StaffWorkItemsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, feature: "staff.daily_work" } },
  { path: "staff-daily-work", component: StaffDailyWorkComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, feature: "staff.daily_work" } },
  { path: "staff-payments", component: StaffPaymentsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ALL_ROLES, requireShop: true, feature: "staff.payments" } },
  { path: "staff-payable-summary", component: StaffPayableSummaryComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "staff.summary" } },
  { path: "factory-product-master", component: FactoryProductMasterComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "factory.product_master" } },
  { path: "factory-verification", component: FactoryVerificationComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "factory.verification" } },
  { path: "raw-material-purchase", component: RawMaterialPurchaseComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "factory.raw_material_purchase" } },
  { path: "raw-material-register", component: RawMaterialRegisterComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "factory.raw_material_master" } },
  { path: "factory-report", component: FactoryReportComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: MANAGER_AND_ABOVE, requireShop: true, feature: "factory.report" } },
  { path: "users", component: UserComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, feature: "people.users" } },
  { path: "shops", component: ManageShopsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ["SUPER_ADMIN"] } },
  { path: "settings", component: SettingsComponent, canActivate: [SecurePageGuardGuard, RoleGuard], data: { roles: ADMIN_AND_ABOVE, feature: "settings.permissions" } },
];
