const EntityAuditLog = require("../models/EntityAuditLog");

const logEntityAudit = async ({
  shop = null,
  entityType,
  entityId,
  action,
  actor,
  meta = {},
}) => {
  try {
    if (!entityType || !entityId || !action || !actor) return;
    await EntityAuditLog.create({
      shop,
      entityType,
      entityId,
      action,
      actor,
      meta,
    });
  } catch (err) {
    // Audit should not block business flow
  }
};

module.exports = {
  logEntityAudit,
};
