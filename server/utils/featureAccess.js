const roleFeaturePolicy = require("../config/roleFeaturePolicy");
const ROLES = require("../config/roles");
const RoleFeatureSetting = require("../models/RoleFeatureSetting");

const EDITABLE_ROLES = [ROLES.STAFF, ROLES.MANAGER, ROLES.ADMIN];
const POLICY_SCOPE = "GLOBAL";

const normalizePolicy = (policy = {}) => {
  const normalized = {};

  EDITABLE_ROLES.forEach((role) => {
    const entries = Array.isArray(policy?.[role]) ? policy[role] : roleFeaturePolicy[role] || [];
    normalized[role] = [...new Set(entries.filter(Boolean))];
  });

  normalized[ROLES.SUPER_ADMIN] = ["*"];
  return normalized;
};

const getStoredRoleFeaturePolicy = async () => {
  const settings = await RoleFeatureSetting.findOne({ scope: POLICY_SCOPE }).lean();
  return settings?.policy || {};
};

const getEffectiveRoleFeaturePolicy = async () => {
  const storedPolicy = await getStoredRoleFeaturePolicy();
  return normalizePolicy(storedPolicy);
};

const getAllowedFeaturesForRole = async (role) => {
  if (!role) return [];
  const effectivePolicy = await getEffectiveRoleFeaturePolicy();
  return effectivePolicy[role] || [];
};

const hasFeatureAccess = async (role, featureKey) => {
  if (!role || !featureKey) return false;
  const allowed = await getAllowedFeaturesForRole(role);
  return allowed.includes("*") || allowed.includes(featureKey);
};

const saveRoleFeaturePolicy = async (policy = {}, updatedBy = null) => {
  const normalized = normalizePolicy(policy);
  await RoleFeatureSetting.findOneAndUpdate(
    { scope: POLICY_SCOPE },
    {
      $set: {
        policy: normalized,
        updatedBy: updatedBy || null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return normalized;
};

module.exports = {
  EDITABLE_ROLES,
  normalizePolicy,
  getEffectiveRoleFeaturePolicy,
  getAllowedFeaturesForRole,
  hasFeatureAccess,
  saveRoleFeaturePolicy,
};
