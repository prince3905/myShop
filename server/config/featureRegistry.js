const FEATURE_REGISTRY = [
  {
    module: "dashboard",
    features: [
      { key: "dashboard.basic", label: "Dashboard Basic" },
      { key: "dashboard.financial", label: "Dashboard Financial" },
      { key: "dashboard.global", label: "Dashboard Global" },
    ],
  },
  {
    module: "sales",
    features: [
      { key: "sales.list", label: "Sales List" },
      { key: "sales.create", label: "Create Sale" },
      { key: "sales.edit", label: "Edit Sale" },
      { key: "sales.delete", label: "Delete Sale" },
      { key: "sales.return", label: "Sale Return" },
      { key: "sales.payment", label: "Sale Payment" },
      { key: "sales.reports", label: "Sales Reports" },
      { key: "sales.profit", label: "Sales Profit" },
      { key: "sales.pos", label: "POS" },
      { key: "sales.orders", label: "Orders" },
      { key: "sales.orders.manage", label: "Manage Orders" },
    ],
  },
  {
    module: "inventory",
    features: [
      { key: "inventory.products", label: "Products" },
      { key: "inventory.products.manage", label: "Manage Products" },
      { key: "inventory.product_details", label: "Product Details" },
      { key: "inventory.product_details.manage", label: "Manage Product Details" },
      { key: "inventory.stocks", label: "Stocks" },
      { key: "inventory.purchase", label: "Purchase" },
      { key: "inventory.purchase.manage", label: "Manage Purchase" },
    ],
  },
  {
    module: "factory",
    features: [
      { key: "factory.product_master", label: "Factory Product Master" },
      { key: "factory.verification", label: "Factory Verification" },
      { key: "factory.raw_material_master", label: "Raw Material Master" },
      { key: "factory.raw_material_purchase", label: "Raw Material Purchase" },
      { key: "factory.report", label: "Factory Report" },
      { key: "factory.push_to_shop", label: "Push To Shop" },
    ],
  },
  {
    module: "staff",
    features: [
      { key: "staff.master", label: "Staff Master" },
      { key: "staff.master.manage", label: "Manage Staff Master" },
      { key: "staff.daily_work", label: "Staff Daily Work" },
      { key: "staff.payments", label: "Staff Payments" },
      { key: "staff.payments.manage", label: "Manage Staff Payments" },
      { key: "staff.summary", label: "Staff Summary" },
    ],
  },
  {
    module: "expenses",
    features: [
      { key: "expenses.daily", label: "Daily Expense" },
      { key: "expenses.daily.manage", label: "Manage Daily Expense" },
      { key: "expenses.report", label: "Expense Report" },
    ],
  },
  {
    module: "people",
    features: [
      { key: "people.customers", label: "Customers" },
      { key: "people.customers.manage", label: "Manage Customers" },
      { key: "people.distributors", label: "Distributors" },
      { key: "people.distributors.manage", label: "Manage Distributors" },
      { key: "people.users", label: "Users" },
    ],
  },
  {
    module: "settings",
    features: [
      { key: "settings.profile", label: "Profile Settings" },
      { key: "settings.shop", label: "Shop Settings" },
      { key: "settings.permissions", label: "Role & Permissions" },
      { key: "settings.system", label: "System Settings" },
    ],
  },
];

module.exports = FEATURE_REGISTRY;
