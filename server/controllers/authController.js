const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Shop = require("../models/Shop");
const rolePermissions = require("../config/permissions");

const pushAuditLog = async (userId, action, details = "") => {
  await User.findByIdAndUpdate(userId, {
    $push: {
      auditLogs: {
        $each: [{ action, details, createdAt: new Date() }],
        $slice: -50,
      },
    },
  });
};

const resolveShopForUser = async (user) => {
  if (!user?.shop) return null;
  return Shop.findById(user.shop);
};

exports.login = async (req, res) => {
  try {
    const { shopCode, email, password } = req.body;
    const normalizedShopCode = shopCode?.trim()?.toUpperCase() || null;
    console.log("[FLOW][AUTH][LOGIN] request", { email, shopCode });

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and Password required",
      });
    }

    const user = await User.findOne({ email })
      .select("+password");
    console.log("[FLOW][AUTH][LOGIN] userLookup", {
      email,
      found: !!user,
      userId: user?._id?.toString(),
      role: user?.role,
    });

    if (!user) {
      return res.status(400).json({
        message: "User not found for this shop",
      });
    }

    let selectedShop = null;

    if (normalizedShopCode) {
      selectedShop = await Shop.findOne({
        shopCode: normalizedShopCode,
        isActive: true,
      });
      console.log("[FLOW][AUTH][LOGIN] shopLookup", {
        shopCode: normalizedShopCode,
        found: !!selectedShop,
        shopId: selectedShop?._id?.toString(),
      });

      if (!selectedShop) {
        return res.status(404).json({
          message: "Shop not found",
        });
      }
    }

    if (user.role !== "SUPER_ADMIN") {
      if (!selectedShop) {
        return res.status(400).json({
          message: "Shop Code required",
        });
      }

      const userShopId = user.shop?.toString();
      const selectedShopId = selectedShop._id.toString();

      // Backward compatibility: old users may not have user.shop set, so allow owner match
      const isOwnerOfSelectedShop =
        !userShopId &&
        (await Shop.exists({ _id: selectedShop._id, owner: user._id, isActive: true }));

      if (userShopId !== selectedShopId && !isOwnerOfSelectedShop) {
        return res.status(403).json({
          message: "User not found for this shop",
        });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "User is disabled",
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    console.log("[FLOW][AUTH][LOGIN] passwordCheck", {
      userId: user._id.toString(),
      isMatch,
    });

    if (!isMatch) {
      return res.status(400).json({
        message: "Wrong password",
      });
    }

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
    const sessionId = crypto.randomUUID();
    const session = {
      sid: sessionId,
      userAgent: req.headers["user-agent"] || "Unknown",
      ip: req.ip || req.headers["x-forwarded-for"] || "Unknown",
      createdAt: new Date(),
      lastSeenAt: new Date(),
    };
    await User.findByIdAndUpdate(user._id, {
      $push: { sessions: { $each: [session], $slice: -20 } },
    });
    await pushAuditLog(user._id, "LOGIN", "User logged in");

    const isSuperAdmin = user.role === "SUPER_ADMIN";
    const sessionShop = selectedShop
      ? selectedShop._id
      : isSuperAdmin
        ? null
        : (user.shop || null);
    const sessionShopCode = selectedShop
      ? selectedShop.shopCode
      : isSuperAdmin
        ? null
        : null;

    // Generate token
    const token = require("jsonwebtoken").sign(
      {
        id: user._id,
        role: user.role,
        shop: sessionShop,
        sid: sessionId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    console.log("[FLOW][AUTH][LOGIN] success", {
      userId: user._id.toString(),
      role: user.role,
      shopId: sessionShop?.toString?.() || null,
      shopCode: sessionShopCode,
    });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        shop: sessionShop,
        shopCode: sessionShopCode,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.authenticated = async (req, res) => {
  try {
    let shopCode = null;
    let shopName = null;

    if (req.user?.shop) {
      const shop = await Shop.findById(req.user.shop).select("shopCode name");
      shopCode = shop?.shopCode || null;
      shopName = shop?.name || null;
    }

    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        shop: req.user.shop || null,
        shopCode,
        shopName,
        mode:
          req.user.role === "SUPER_ADMIN"
            ? (req.user.shop ? "SHOP_WISE" : "GLOBAL")
            : "SHOP_WISE",
        permissions: rolePermissions[req.user.role] || [],
        phoneNo: req.user.phoneNo || null,
        pFname: req.user.pFname || "",
        pLname: req.user.pLname || "",
        pEmail: req.user.pEmail || "",
        pPhoneNo: req.user.pPhoneNo || "",
        twoFactorEnabled: req.user.twoFactorEnabled || false,
        lastLogin: req.user.lastLogin || null,
        createdAt: req.user.createdAt || null,
        isActive: req.user.isActive,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load profile",
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = ["pFname", "pLname", "pEmail", "pPhoneNo", "phoneNo"];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    console.log("[FLOW][AUTH][PROFILE][UPDATE] request", {
      userId: req.user?._id?.toString(),
      keys: Object.keys(updateData),
    });

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );
    await pushAuditLog(req.user._id, "PROFILE_UPDATED", "Updated profile settings");

    let shopCode = null;
    let shopName = null;
    if (updatedUser?.shop) {
      const shop = await Shop.findById(updatedUser.shop).select("shopCode name");
      shopCode = shop?.shopCode || null;
      shopName = shop?.name || null;
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        role: updatedUser.role,
        shop: updatedUser.shop || null,
        shopCode,
        shopName,
        mode:
          updatedUser.role === "SUPER_ADMIN"
            ? (updatedUser.shop ? "SHOP_WISE" : "GLOBAL")
            : "SHOP_WISE",
        permissions: rolePermissions[updatedUser.role] || [],
        phoneNo: updatedUser.phoneNo || null,
        pFname: updatedUser.pFname || "",
        pLname: updatedUser.pLname || "",
        pEmail: updatedUser.pEmail || "",
        pPhoneNo: updatedUser.pPhoneNo || "",
        twoFactorEnabled: updatedUser.twoFactorEnabled || false,
        lastLogin: updatedUser.lastLogin || null,
        createdAt: updatedUser.createdAt || null,
        isActive: updatedUser.isActive,
      },
    });
  } catch (error) {
    console.error("[FLOW][AUTH][PROFILE][UPDATE] error", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, password, phoneNo } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      email,
      password,
      phoneNo,
      role: "STAFF",
    });

    res.status(201).json({
      message: "User created successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    console.log("[FLOW][AUTH][PROTECT] tokenPresent", !!token);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("[FLOW][AUTH][PROTECT] decoded", {
      id: decoded?.id,
      role: decoded?.role,
      shop: decoded?.shop,
    });

    const user = await User.findById(decoded.id);
    console.log("[FLOW][AUTH][PROTECT] userLookup", {
      found: !!user,
      userId: user?._id?.toString(),
      role: user?.role,
      shop: user?.shop?.toString(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

exports.getSessions = async (req, res) => {
  try {
    const sessions = (req.user.sessions || [])
      .sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))
      .map((s) => ({
        sid: s.sid,
        userAgent: s.userAgent,
        ip: s.ip,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
      }));

    return res.status(200).json({
      success: true,
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sessions",
    });
  }
};

exports.logoutCurrent = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(200).json({
        success: true,
        message: "Logged out",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded?.sid) {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { sessions: { sid: decoded.sid } },
      });
    }
    await pushAuditLog(req.user._id, "LOGOUT", "Logged out from current session");

    return res.status(200).json({
      success: true,
      message: "Logged out",
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      message: "Logged out",
    });
  }
};

exports.logoutAllDevices = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { sessions: [] },
    });
    await pushAuditLog(req.user._id, "LOGOUT_ALL", "Logged out from all sessions");

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to logout all devices",
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    user.password = newPassword;
    user.sessions = [];
    await user.save();
    await pushAuditLog(req.user._id, "PASSWORD_CHANGED", "Password changed");

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please login again.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to change password",
    });
  }
};

exports.toggleTwoFactor = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "enabled must be boolean",
      });
    }

    const updated = await User.findByIdAndUpdate(
      req.user._id,
      { twoFactorEnabled: enabled },
      { new: true }
    );
    await pushAuditLog(req.user._id, "TWO_FACTOR_UPDATED", `2FA set to ${enabled}`);

    return res.status(200).json({
      success: true,
      message: `2FA ${enabled ? "enabled" : "disabled"} successfully`,
      twoFactorEnabled: updated.twoFactorEnabled,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update 2FA",
    });
  }
};

exports.getSettingsOverview = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const shop = await resolveShopForUser(user);

    return res.status(200).json({
      success: true,
      data: {
        profile: {
          id: user._id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          twoFactorEnabled: !!user.twoFactorEnabled,
        },
        rolePermissions: rolePermissions[user.role] || [],
        notifications: user.notificationSettings || {},
        preferences: user.preferences || {},
        shop: shop
          ? {
              id: shop._id,
              name: shop.name,
              shopCode: shop.shopCode,
              contactNumber: shop.contactNumber,
              email: shop.email,
              address: shop.address,
              subscriptionPlan: shop.subscriptionPlan,
              subscriptionExpiry: shop.subscriptionExpiry,
              integrationSettings: shop.integrationSettings || {},
              backupSettings: shop.backupSettings || {},
              isActive: shop.isActive,
            }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load settings overview",
    });
  }
};

exports.updateNotificationSettings = async (req, res) => {
  try {
    const payload = {
      email: !!req.body?.email,
      sms: !!req.body?.sms,
      whatsapp: !!req.body?.whatsapp,
      inApp: !!req.body?.inApp,
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { notificationSettings: payload },
      { new: true }
    );
    await pushAuditLog(req.user._id, "NOTIFICATION_SETTINGS_UPDATED", "Updated notification settings");

    return res.status(200).json({
      success: true,
      message: "Notification settings updated",
      notificationSettings: user.notificationSettings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update notification settings",
    });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const payload = {
      language: req.body?.language || "en",
      timezone: req.body?.timezone || "Asia/Kolkata",
      currency: req.body?.currency || "INR",
      dateFormat: req.body?.dateFormat || "DD/MM/YYYY",
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { preferences: payload },
      { new: true }
    );
    await pushAuditLog(req.user._id, "PREFERENCES_UPDATED", "Updated app preferences");

    return res.status(200).json({
      success: true,
      message: "App preferences updated",
      preferences: user.preferences,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update app preferences",
    });
  }
};

exports.updateShopSettings = async (req, res) => {
  try {
    const shop = await resolveShopForUser(req.user);
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "No shop assigned. Switch to shop mode first.",
      });
    }

    const allowed = ["name", "contactNumber", "email", "address"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        shop[key] = req.body[key];
      }
    }
    await shop.save();
    await pushAuditLog(req.user._id, "SHOP_SETTINGS_UPDATED", "Updated shop settings");

    return res.status(200).json({
      success: true,
      message: "Shop settings updated",
      shop,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update shop settings",
    });
  }
};

exports.updateIntegrations = async (req, res) => {
  try {
    const shop = await resolveShopForUser(req.user);
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "No shop assigned. Switch to shop mode first.",
      });
    }

    shop.integrationSettings = {
      gstEnabled: !!req.body?.gstEnabled,
      whatsappEnabled: !!req.body?.whatsappEnabled,
      smsEnabled: !!req.body?.smsEnabled,
      emailEnabled: !!req.body?.emailEnabled,
      paymentGateway: req.body?.paymentGateway || "NONE",
    };
    await shop.save();
    await pushAuditLog(req.user._id, "INTEGRATIONS_UPDATED", "Updated integration settings");

    return res.status(200).json({
      success: true,
      message: "Integrations updated",
      integrationSettings: shop.integrationSettings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update integrations",
    });
  }
};

exports.updateBackupSettings = async (req, res) => {
  try {
    const shop = await resolveShopForUser(req.user);
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "No shop assigned. Switch to shop mode first.",
      });
    }

    shop.backupSettings = {
      autoBackup: !!req.body?.autoBackup,
      frequency: req.body?.frequency || "WEEKLY",
      lastBackupAt: shop.backupSettings?.lastBackupAt || null,
    };
    await shop.save();
    await pushAuditLog(req.user._id, "BACKUP_SETTINGS_UPDATED", "Updated backup settings");

    return res.status(200).json({
      success: true,
      message: "Backup settings updated",
      backupSettings: shop.backupSettings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update backup settings",
    });
  }
};

exports.runBackupNow = async (req, res) => {
  try {
    const shop = await resolveShopForUser(req.user);
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "No shop assigned. Switch to shop mode first.",
      });
    }

    shop.backupSettings = {
      ...(shop.backupSettings || {}),
      lastBackupAt: new Date(),
    };
    await shop.save();
    await pushAuditLog(req.user._id, "BACKUP_RUN", "Manual backup triggered");

    return res.status(200).json({
      success: true,
      message: "Backup triggered successfully",
      lastBackupAt: shop.backupSettings.lastBackupAt,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to trigger backup",
    });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("auditLogs");
    const logs = (user.auditLogs || []).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return res.status(200).json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
    });
  }
};

exports.deactivateAccount = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isActive: false,
      sessions: [],
    });
    await pushAuditLog(req.user._id, "ACCOUNT_DEACTIVATED", "Account deactivated by user");
    return res.status(200).json({
      success: true,
      message: "Account deactivated",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to deactivate account",
    });
  }
};

exports.deactivateCurrentShop = async (req, res) => {
  try {
    const shop = await resolveShopForUser(req.user);
    if (!shop) {
      return res.status(400).json({
        success: false,
        message: "No shop assigned",
      });
    }

    shop.isActive = false;
    await shop.save();
    await pushAuditLog(req.user._id, "SHOP_DEACTIVATED", `Shop ${shop._id} deactivated`);

    return res.status(200).json({
      success: true,
      message: "Shop deactivated",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to deactivate shop",
    });
  }
};
