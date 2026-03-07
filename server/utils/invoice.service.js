const Counter = require("../models/Counter");

const getPeriodYYMM = (date = new Date()) => {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
};

const getPrefixByType = (type) => {
  const t = `${type || ""}`.trim().toUpperCase();
  if (t === "PURCHASE") return "PINV";
  if (t === "ORDER") return "OINV";
  return "SINV";
};

const nextSequence = async (key) => {
  const row = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return Number(row?.seq || 1);
};

const generateInvoiceNo = async ({ type, date = new Date() }) => {
  const prefix = getPrefixByType(type);
  const period = getPeriodYYMM(date);
  const key = `INV:${prefix}:${period}`;
  const seq = await nextSequence(key);
  return `${prefix}-${period}-${String(seq).padStart(4, "0")}`;
};

module.exports = {
  generateInvoiceNo,
};
