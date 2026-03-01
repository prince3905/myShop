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
  updateNotificationSettings,
  updatePreferences,
  updateShopSettings,
  updateIntegrations,
  updateBackupSettings,
  runBackupNow,
  getAuditLogs,
  deactivateAccount,
  deactivateCurrentShop,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/authenticated", protect, authenticated);
router.put("/profile", protect, updateProfile);
router.get("/sessions", protect, getSessions);
router.get("/logout", protect, logoutCurrent);
router.post("/logout-all", protect, logoutAllDevices);
router.put("/change-password", protect, changePassword);
router.put("/2fa", protect, toggleTwoFactor);
router.get("/settings-overview", protect, getSettingsOverview);
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
