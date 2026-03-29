import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { AdminLayoutRoutes } from "./admin-layout.routing";
import { DashboardComponent } from "../../dashboard/dashboard.component";
import { UserProfileComponent } from "../../user-profile/user-profile.component";
import { MatButtonModule } from "@angular/material/button";
import { MatRippleModule } from "@angular/material/core";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatSelectModule } from "@angular/material/select";
import { MatCardModule } from "@angular/material/card";
import { MatDialogModule } from "@angular/material/dialog";
import { ItemsListComponent } from "app/all-items/items-list/items-list.component";
import { AddItemsComponent } from "app/all-items/add-items/add-items.component";
import { MatIconModule } from "@angular/material/icon";
import { AddUserComponent } from "app/all-users/add-user/add-user.component";
import { UserComponent } from "app/all-users/user/user.component";
import { ItemDetailsComponent } from "app/all-items/item-details/item-details.component";
import { ConfirmDialogComponent } from "app/shared/components/confirm-dialog/confirm-dialog.component";
import { MatInputModule } from "@angular/material/input";
import { MatMenuModule } from "@angular/material/menu";
import { MatExpansionModule } from "@angular/material/expansion";
import { AddCategoryComponent } from "app/all-items/add-category/add-category.component";
import { AddBrandComponent } from "app/all-items/add-brand/add-brand.component";
import { SalesListComponent } from "app/sales/sales-list/sales-list.component";
import { AddSalesComponent } from "app/sales/add-sales/add-sales.component";
import { MatDividerModule } from "@angular/material/divider";
import { MatDatepickerModule } from "@angular/material/datepicker";
import { MatNativeDateModule } from "@angular/material/core";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { StocksComponent } from "app/stocks/stocks.component";
import { StockReorderPreviewDialogComponent } from "app/stocks/stock-reorder-preview-dialog.component";
import { MatPaginatorModule } from "@angular/material/paginator";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatSnackBarModule } from "@angular/material/snack-bar";
import { MatChipsModule } from "@angular/material/chips";
import { OrdersComponent } from "app/orders/orders.component";
import { CreateOrderComponent } from "app/orders/create-order.component";
import { OrderDetailsComponent } from "app/orders/order-details.component";
import { OrderPaymentDialogComponent } from "app/orders/order-payment-dialog.component";
import { CustomersComponent } from "app/customers/customers.component";
import { DistributorsComponent } from "app/all-distributors/distributors/distributors.component";
import { AddDistributorsComponent } from "app/all-distributors/add-distributors/add-distributors.component";
import { ViewDistributorComponent } from "app/all-distributors/view-distributor/view-distributor.component";
import { LedgerEntryComponent } from "app/all-distributors/ledger-entry/ledger-entry.component";
import { AddDetailsComponent } from "app/all-items/add-details/add-details.component";
import { LabelPrintOptionsDialogComponent } from "app/all-items/add-details/label-print-options-dialog.component";
import { SettingsComponent } from "app/settings/settings.component";
import { ManageShopsComponent } from "app/shops/manage-shops/manage-shops.component";
import { PurchaseConsoleComponent } from "app/purchases/purchase-console/purchase-console.component";
import { PurchaseReturnDialogComponent } from "app/purchases/purchase-return-dialog/purchase-return-dialog.component";
import { HasRoleDirective } from "app/shared/directives/has-role.directive";
import { CapitalizeFirstDirective } from "app/shared/directives/capitalize-first.directive";
import { PosComponent } from "app/sales/pos/pos.component";
import { ReturnsComponent } from "app/sales/returns/returns.component";
import { SalePaymentDialogComponent } from "app/sales/sale-payment-dialog/sale-payment-dialog.component";
import { SalesReportsComponent } from "app/sales/sales-reports/sales-reports.component";
import { CustomerDetailsComponent } from "app/customers/customer-details/customer-details.component";
import { AddCustomerDialogComponent } from "app/sales/add-customer-dialog/add-customer-dialog.component";
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
    MatCheckboxModule,
    MatSnackBarModule,
    MatChipsModule,
  ],
  declarations: [
    DashboardComponent,
    ItemsListComponent,
    AddItemsComponent,
    UserProfileComponent,
    UserComponent,
    AddUserComponent,
    ItemDetailsComponent,
    ConfirmDialogComponent,
    AddCategoryComponent,
    AddBrandComponent,
    SalesListComponent,
    AddSalesComponent,
    StocksComponent,
    StockReorderPreviewDialogComponent,
    OrdersComponent,
    CreateOrderComponent,
    OrderDetailsComponent,
    OrderPaymentDialogComponent,
    CustomersComponent,
    CustomerDetailsComponent,
    AddDistributorsComponent,
    DistributorsComponent,
    ViewDistributorComponent,
    LedgerEntryComponent,
    AddDetailsComponent,
    LabelPrintOptionsDialogComponent,
    SettingsComponent,
    ManageShopsComponent,
    PurchaseConsoleComponent,
    PurchaseReturnDialogComponent,
    PosComponent,
    ReturnsComponent,
    SalePaymentDialogComponent,
    SalesReportsComponent,
    AddCustomerDialogComponent,
    DailyExpenseComponent,
    ExpenseReportComponent,
    StaffMasterComponent,
    StaffWorkItemsComponent,
    StaffDailyWorkComponent,
    StaffPaymentsComponent,
    StaffPayableSummaryComponent,
    FactoryProductMasterComponent,
    FactoryVerificationComponent,
    RawMaterialPurchaseComponent,
    RawMaterialRegisterComponent,
    FactoryReportComponent,
    HasRoleDirective,
    CapitalizeFirstDirective,
  ],
})
export class AdminLayoutModule {
  panelOpenState = false;
}
