const mongoose = require("mongoose");

const entityAuditLogSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      index: true,
    },
    meta: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

entityAuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model("EntityAuditLog", entityAuditLogSchema);
