const EntityAuditLog = require("../models/EntityAuditLog");
const logger = require("./logger");

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
    logger.error("logEntityAudit Error:", err);
  }
};

module.exports = {
  logEntityAudit,
};
