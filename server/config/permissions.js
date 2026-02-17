const ROLES = require("./roles");

const rolePermissions = {
  [ROLES.SUPER_ADMIN]: [
    "MANAGE_ALL_SHOPS",
    "CREATE_ADMIN",
    "VIEW_ALL_DATA",
  ],

  [ROLES.ADMIN]: [
    "CREATE_MANAGER",
    "CREATE_STAFF",
    "MANAGE_PRODUCTS",
    "MANAGE_STOCK",
    "VIEW_REPORTS",
  ],

  [ROLES.MANAGER]: [
    "MANAGE_PRODUCTS",
    "MANAGE_STOCK",
    "VIEW_REPORTS",
  ],

  [ROLES.STAFF]: [
    "CREATE_SALE",
  ],
};

module.exports = rolePermissions;