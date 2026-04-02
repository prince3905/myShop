const roleFeaturePolicy = require("../config/roleFeaturePolicy");

const hasFeatureAccess = (role, featureKey) => {
  if (!role || !featureKey) return false;
  const allowed = roleFeaturePolicy[role] || [];
  return allowed.includes("*") || allowed.includes(featureKey);
};

module.exports = {
  hasFeatureAccess,
};
