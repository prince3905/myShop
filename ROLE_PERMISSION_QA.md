# Role Permission QA Checklist

Use this checklist after any role, permission, dashboard, sidebar, route, or backend access change.

## Core Rules

- `STAFF` must not see cost price or profit anywhere.
- `MANAGER` must not see cost price or profit anywhere.
- If a role does not have a feature:
  - sidebar item must not appear
  - direct route open must fail
  - page action buttons must not appear
  - backend API must reject the action
- `SUPER_ADMIN` permission changes should take effect immediately after save and refresh.

## Roles

### STAFF

Expected access:
- dashboard basic
- sales list
- POS
- daily expense
- daily work
- payment and advance
- customers
- optional products list and product details if explicitly allowed

Expected restrictions:
- no sales and profit
- no cost price
- no profit
- no expense report
- no factory report
- no factory verification
- no push to shop
- no system settings

### MANAGER

Expected access:
- dashboard basic
- orders
- expense report
- staff summary
- factory verification
- push to shop
- factory report
- raw material purchase
- raw material master
- factory product master

Expected restrictions:
- no sales and profit
- no cost price
- no profit
- no super admin settings

### ADMIN

Expected access:
- full own-shop operations
- reports
- sales and profit
- sensitive pricing
- users
- distributors
- settings

### SUPER_ADMIN

Expected access:
- everything
- global and shop-wise
- settings and role permissions
- permission override management

## Smoke Test Matrix

### 1. STAFF basic entry flow

Enable:
- `sales.pos`
- `sales.create`
- `sales.payment`
- `staff.daily_work`
- `staff.payments`
- `expenses.daily`
- `people.customers`

Verify:
- sidebar shows only allowed menus
- POS opens
- item add works
- stock lookup does not 403
- daily work opens
- staff dropdown shows staff options
- factory product dropdown shows factory products
- payment and advance opens
- customer add and edit works
- sales and profit does not appear
- cost and profit values do not appear anywhere

### 2. STAFF product read-only flow

Enable:
- `inventory.products`
- `inventory.product_details`

Disable:
- `inventory.products.manage`
- `inventory.product_details.manage`

Verify:
- products list visible
- item details visible
- add product page blocked
- edit product actions blocked
- variation edit actions blocked

### 3. MANAGER operations flow

Enable:
- `sales.orders`
- `sales.orders.manage`
- `expenses.report`
- `staff.summary`
- `factory.product_master`
- `factory.verification`
- `factory.raw_material_purchase`
- `factory.raw_material_master`
- `factory.report`
- `factory.push_to_shop`

Verify:
- orders list opens
- order actions work
- expense report opens
- factory verification opens
- approve works
- push to shop works
- factory push history visible
- factory pending stock visible
- no cost/profit leak on dashboard, factory, stock, order, or product screens

### 4. ADMIN financial flow

Enable:
- `sales.profit`
- `inventory.purchase`
- `inventory.purchase.manage`
- `people.users`
- `people.distributors`
- `people.distributors.manage`
- `settings.permissions`

Verify:
- sales and profit page opens
- profit KPIs visible
- cost fields visible where expected
- purchase management works
- user management works
- distributor management works
- settings opens

### 5. SUPER_ADMIN permission override flow

Verify:
- role permission save works
- page refresh happens after save
- updated role gets new access after refresh
- removed access hides menu, route, action, and backend access

## Sensitive Pricing Audit

Check all of these with `STAFF` and `MANAGER`:
- dashboard
- item list
- item details
- variation details
- stocks
- orders
- sales reports
- factory verification
- factory report
- daily work

Expected:
- no cost price
- no profit
- no gross margin

## Factory Flow Audit

### STAFF

Verify:
- daily work staff dropdown loads
- factory product dropdown loads
- raw material preview shows actual stock
- save works when stock is sufficient

### MANAGER

Verify:
- verification list opens
- approve works
- target shop can be selected
- push to shop works
- factory push history records:
  - source shop
  - target shop
  - sku
  - qty
  - pushed by
  - pushed at
- factory pending stock decreases after push

## Customer Audit Trail

With customer edit allowed:
- change name
- change phone
- change address

Verify:
- change history shows:
  - who changed it
  - when it changed
  - field name
  - old value
  - new value

## Regression Check Before Push

- run frontend build
- run touched backend route/controller syntax checks
- confirm no unintended sidebar leak
- confirm no route opens without feature
- confirm no backend write passes without feature
