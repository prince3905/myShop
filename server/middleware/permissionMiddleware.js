const rolePermissions = require("../config/permissions");

exports.authorizePermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user.role;

    const permissions = rolePermissions[userRole];

    if (!permissions || !permissions.includes(permission)) {
      return res.status(403).json({
        message: "You do not have permission",
      });
    }

    next();
  };
};