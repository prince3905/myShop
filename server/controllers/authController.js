const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const Shop = require("../models/Shop");
const rolePermissions = require("../config/permissions");
const featureRegistry = require("../config/featureRegistry");
const {
  getEffectiveRoleFeaturePolicy,
  getAllowedFeaturesForRole,
  saveRoleFeaturePolicy,
  EDITABLE_ROLES,
} = require("../utils/featureAccess");

const SESSION_TTL = process.env.JWT_EXPIRES_IN || "12h";

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

const resolveShopForRequest = async (req) => {
  const selectedShopId =
    req.headers["x-shop-id"] ||
    req.query?.shopId ||
    req.body?.shop ||
    req.user?.shop ||
    null;

  if (!selectedShopId) return null;

  return Shop.findOne({ _id: selectedShopId, isActive: true });
};

const buildUserAccessPayload = async (userLike) => {
  let shopCode = null;
  let shopName = null;

  if (userLike?.shop) {
    const shop = await Shop.findById(userLike.shop).select("shopCode name");
    shopCode = shop?.shopCode || null;
    shopName = shop?.name || null;
  }

  return {
    id: userLike._id,
    email: userLike.email,
    role: userLike.role,
    shop: userLike.shop || null,
    shopCode,
    shopName,
    mode:
      userLike.role === "SUPER_ADMIN"
        ? (userLike.shop ? "SHOP_WISE" : "GLOBAL")
        : "SHOP_WISE",
    permissions: rolePermissions[userLike.role] || [],
    allowedFeatures: await getAllowedFeaturesForRole(userLike.role),
    phoneNo: userLike.phoneNo || null,
    pFname: userLike.pFname || "",
    pLname: userLike.pLname || "",
    pEmail: userLike.pEmail || "",
    pPhoneNo: userLike.pPhoneNo || "",
    twoFactorEnabled: userLike.twoFactorEnabled || false,
    lastLogin: userLike.lastLogin || null,
    createdAt: userLike.createdAt || null,
    isActive: userLike.isActive,
  };
};

exports.login = async (req, res) => {
  try {
    const { shopCode, email, password } = req.body;
    const normalizedShopCode = shopCode?.trim()?.toUpperCase() || null;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and Password required",
      });
    }

    const user = await User.findOne({ email })
      .select("+password");

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
      { expiresIn: SESSION_TTL },
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        ...(await buildUserAccessPayload({
          ...user.toObject(),
          shop: sessionShop,
        })),
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
    return res.status(200).json({
      success: true,
      user: await buildUserAccessPayload(req.user),
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

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );
    await pushAuditLog(req.user._id, "PROFILE_UPDATED", "Updated profile settings");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: await buildUserAccessPayload(updatedUser),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

exports.register = async (req, res) => {
  try {
    const { email, password, phoneNo, role, name, shop } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    // Validate role - prevent SUPER_ADMIN assignment via this endpoint
    // SUPER_ADMIN can only be assigned directly in database
    const allowedRoles = ["ADMIN", "MANAGER", "STAFF"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({
        message: `Invalid role. Allowed: ${allowedRoles.join(", ")}`,
      });
    }
    const userRole = role || "STAFF";

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      email,
      password,
      phoneNo,
      name,
      role: userRole,
      shop: shop || null,
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

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
    const shop = await resolveShopForRequest(req);
    const effectiveRoleFeaturePolicy = await getEffectiveRoleFeaturePolicy();

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
        featureRegistry,
        roleFeaturePolicy: effectiveRoleFeaturePolicy,
        editableRoles: EDITABLE_ROLES,
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

exports.updateRoleFeaturePolicy = async (req, res) => {
  try {
    if (req.user?.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admin can update role access policy",
      });
    }

    const policy = req.body?.roleFeaturePolicy || {};
    const savedPolicy = await saveRoleFeaturePolicy(policy, req.user._id);
    await pushAuditLog(req.user._id, "ROLE_FEATURE_POLICY_UPDATED", "Updated role and feature access policy");

    return res.status(200).json({
      success: true,
      message: "Role access policy updated",
      roleFeaturePolicy: savedPolicy,
      editableRoles: EDITABLE_ROLES,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update role access policy",
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
    const shop = await resolveShopForRequest(req);
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
    if (req.body?.paymentSettings !== undefined) {
      if (req.user?.role !== "SUPER_ADMIN") {
        return res.status(403).json({
          success: false,
          message: "Only Super Admin can update UPI settings",
        });
      }

      shop.paymentSettings = {
        upiId: `${req.body?.paymentSettings?.upiId || ""}`.trim().toLowerCase(),
        upiDisplayName: `${req.body?.paymentSettings?.upiDisplayName || ""}`.trim(),
      };
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
    const shop = await resolveShopForRequest(req);
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
    const shop = await resolveShopForRequest(req);
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
    const shop = await resolveShopForRequest(req);
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
    const shop = await resolveShopForRequest(req);
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
