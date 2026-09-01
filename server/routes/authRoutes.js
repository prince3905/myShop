const express = require("express");
const router = express.Router();
const {
  login,
  register,
  authenticated,
  updateProfile,
  getSessions,
  logoutCurrent,
  logoutAllDevices,
  changePassword,
  toggleTwoFactor,
  getSettingsOverview,
  updateRoleFeaturePolicy,
  updateNotificationSettings,
  updatePreferences,
  updateShopSettings,
  updateIntegrations,
  updateBackupSettings,
  runBackupNow,
  getAuditLogs,
  deactivateAccount,
  deactivateCurrentShop,
  forgotPassword,
  resetPasswordWithOtp,
} = require("../controllers/authController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { validateLogin, validateRegister, validate } = require("../middleware/authValidation");

router.post("/login", validateLogin, validate, login);
router.post("/register", validateRegister, validate, register);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPasswordWithOtp);
router.get("/authenticated", protect, authenticated);
router.put("/profile", protect, updateProfile);
router.get("/sessions", protect, getSessions);
router.get("/logout", protect, logoutCurrent);
router.post("/logout-all", protect, logoutAllDevices);
router.put("/change-password", protect, changePassword);
router.put("/2fa", protect, toggleTwoFactor);
router.get("/settings-overview", protect, getSettingsOverview);
router.put("/settings/role-feature-policy", protect, authorizeRoles("SUPER_ADMIN"), updateRoleFeaturePolicy);
router.put("/settings/notifications", protect, updateNotificationSettings);
router.put("/settings/preferences", protect, updatePreferences);
router.put("/settings/shop", protect, updateShopSettings);
router.put("/settings/integrations", protect, updateIntegrations);
router.put("/settings/backup", protect, updateBackupSettings);
router.post("/settings/backup/run", protect, runBackupNow);
router.get("/settings/audit-logs", protect, getAuditLogs);
router.post("/settings/danger/account-deactivate", protect, deactivateAccount);
router.post("/settings/danger/shop-deactivate", protect, deactivateCurrentShop);

module.exports = router;
