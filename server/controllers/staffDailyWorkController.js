const mongoose = require("mongoose");
const StaffDailyWork = require("../models/StaffDailyWork");
const Staff = require("../models/Staff");
const StaffWorkItem = require("../models/StaffWorkItem");
const FactoryProduct = require("../models/FactoryProduct");
const RawMaterialPurchase = require("../models/RawMaterialPurchase");
const ProductVariation = require("../models/ProductVariation");
const Stock = require("../models/Stock");
const Shop = require("../models/Shop");
const FactoryPushHistory = require("../models/FactoryPushHistory");
const { applyStockTransaction } = require("../utils/stock.service");

const STAFF_ONLY_FILTER = (req) => `${req.user?.role || ""}` === "STAFF";
const MANAGER_AND_ABOVE = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const normalizeDate = (raw) => {
  const d = raw ? new Date(raw) : new Date();
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeOptionalDate = (raw) => {
  if (raw === undefined || raw === null || `${raw}`.trim() === "") {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const populateDailyWorkQuery = (query) =>
  query
    .populate("staff", "name phone staffType workType rateType rate active")
    .populate({
      path: "factoryProduct",
      select: "name unitLabel workerPieceRate standardWasteQtyPerUnit standardWasteUnitLabel standardWasteValuePerUnit standardMaterialLines shopVariation defaultSellingPrice",
      populate: {
        path: "shopVariation",
        select: "sku sellingPrice costPrice attributes",
      },
    })
    .populate("workItem", "itemName workType pieceRate unit active")
    .populate("createdBy", "email role pFname pLname")
    .populate("updatedBy", "email role pFname pLname")
    .populate("verifiedBy", "email role pFname pLname")
    .populate("pushedBy", "email role pFname pLname")
    .populate("pushedToShop", "name shopCode")
    .populate("pushedToVariation", "sku attributes");

const populatePushHistoryQuery = (query) =>
  query
    .populate("sourceShop", "name shopCode")
    .populate("targetShop", "name shopCode")
    .populate("staff", "name workType")
    .populate("factoryProduct", "name")
    .populate("sourceVariation", "sku")
    .populate("targetVariation", "sku")
    .populate("product", "name")
    .populate("model", "name")
    .populate("pushedBy", "email role pFname pLname");

const resolveAccessibleStaffIds = async (req) => {
  return null;
};

const calculateEarnedAmount = (staff, attendanceStatus, unitsCompleted, incomingAmount, pieceRate) => {
  const explicitAmount = Number(incomingAmount);
  if (Number.isFinite(explicitAmount) && explicitAmount > 0) {
    return explicitAmount;
  }

  const rate = Number(staff?.rate || 0);
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }

  if (`${staff?.rateType || ""}` === "PIECE") {
    const resolvedPieceRate = Number(pieceRate ?? staff?.rate ?? 0);
    const units = Number(unitsCompleted || 0);
    return Number.isFinite(units) && units > 0 ? resolvedPieceRate * units : 0;
  }

  if (`${staff?.rateType || ""}` === "MONTHLY") {
    if (attendanceStatus === "ABSENT") {
      return 0;
    }
    const dailyEquivalent = rate / 30;
    return attendanceStatus === "HALF_DAY" ? dailyEquivalent / 2 : dailyEquivalent;
  }

  if (attendanceStatus === "HALF_DAY") {
    return rate / 2;
  }
  if (attendanceStatus === "ABSENT") {
    return 0;
  }
  return rate;
};

const resolveWorkItem = async (req, staff, rawWorkItemId) => {
  const workItemId = `${rawWorkItemId || ""}`.trim();
  if (!workItemId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(workItemId)) {
    return { error: { status: 400, success: false, message: "Valid work item is required" } };
  }

  const item = await StaffWorkItem.findOne({
    _id: workItemId,
    shop: req.shopId,
    isDeleted: false,
  });

  if (!item) {
    return { error: { status: 404, success: false, message: "Work item not found" } };
  }

  if (`${staff?.workType || ""}`.trim() && `${item.workType || ""}`.trim() !== `${staff.workType || ""}`.trim()) {
    return { error: { status: 400, success: false, message: "Selected item does not belong to the staff work type" } };
  }

  return item;
};

const resolveFactoryProduct = async (req, rawFactoryProductId) => {
  const factoryProductId = `${rawFactoryProductId || ""}`.trim();
  if (!factoryProductId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(factoryProductId)) {
    return { error: { status: 400, success: false, message: "Valid factory product is required" } };
  }

  const product = await FactoryProduct.findOne({
    _id: factoryProductId,
    shop: req.shopId,
    isDeleted: false,
  }).lean();

  if (!product) {
    return { error: { status: 404, success: false, message: "Factory product not found" } };
  }

  return product;
};

const validateFactoryProductStock = async ({ req, factoryProduct, unitsCompleted, excludeDailyWorkId = null }) => {
  if (!factoryProduct || Number(unitsCompleted || 0) <= 0) {
    return null;
  }

  const requiredMap = new Map();
  for (const line of factoryProduct?.standardMaterialLines || []) {
    const rawMaterialId = line?.rawMaterial ? String(line.rawMaterial) : "";
    const qtyPerUnit = Number(line?.qtyPerUnit || 0);
    if (qtyPerUnit <= 0) {
      continue;
    }
    if (!rawMaterialId) {
      return {
        status: 400,
        success: false,
        message: `Factory product "${factoryProduct.name}" me raw material mapping missing hai. Product template thik karo.`,
      };
    }

    const existing = requiredMap.get(rawMaterialId) || {
      materialName: `${line?.materialName || "Raw Material"}`.trim(),
      unitLabel: `${line?.unitLabel || "PCS"}`.trim(),
      requiredQty: 0,
    };
    existing.requiredQty += qtyPerUnit * Number(unitsCompleted || 0);
    requiredMap.set(rawMaterialId, existing);
  }

  if (!requiredMap.size) {
    return null;
  }

  const materialIds = Array.from(requiredMap.keys()).map((id) => new mongoose.Types.ObjectId(id));

  const [approvedPurchases, dailyWorks] = await Promise.all([
    RawMaterialPurchase.find({
      shop: req.shopId,
      isDeleted: false,
      status: "APPROVED",
      "items.rawMaterial": { $in: materialIds },
    })
      .select("items")
      .lean(),
    StaffDailyWork.find({
      shop: req.shopId,
      isDeleted: false,
      attendanceStatus: { $ne: "ABSENT" },
      unitsCompleted: { $gt: 0 },
      factoryProduct: { $ne: null },
      ...(excludeDailyWorkId && mongoose.Types.ObjectId.isValid(`${excludeDailyWorkId}`)
        ? { _id: { $ne: new mongoose.Types.ObjectId(`${excludeDailyWorkId}`) } }
        : {}),
    })
      .select("factoryProduct unitsCompleted")
      .populate("factoryProduct", "standardMaterialLines")
      .lean(),
  ]);

  const receivedMap = new Map();
  for (const purchase of approvedPurchases || []) {
    for (const item of purchase?.items || []) {
      const rawMaterialId = item?.rawMaterial ? String(item.rawMaterial) : "";
      if (!requiredMap.has(rawMaterialId)) {
        continue;
      }
      const existing = receivedMap.get(rawMaterialId) || 0;
      receivedMap.set(rawMaterialId, existing + Number(item?.receivedQty || 0));
    }
  }

  const consumedMap = new Map();
  for (const row of dailyWorks || []) {
    const doneQty = Number(row?.unitsCompleted || 0);
    if (doneQty <= 0) {
      continue;
    }
    for (const line of row?.factoryProduct?.standardMaterialLines || []) {
      const rawMaterialId = line?.rawMaterial ? String(line.rawMaterial) : "";
      if (!requiredMap.has(rawMaterialId)) {
        continue;
      }
      const qtyPerUnit = Number(line?.qtyPerUnit || 0);
      const existing = consumedMap.get(rawMaterialId) || 0;
      consumedMap.set(rawMaterialId, existing + (qtyPerUnit * doneQty));
    }
  }

  for (const [rawMaterialId, required] of requiredMap.entries()) {
    const receivedQty = Number(receivedMap.get(rawMaterialId) || 0);
    const consumedQty = Number(consumedMap.get(rawMaterialId) || 0);
    const availableQty = receivedQty - consumedQty;
    if (required.requiredQty > availableQty + 0.0001) {
      return {
        status: 400,
        success: false,
        message: `${required.materialName} ka stock kam hai. Required ${required.requiredQty} ${required.unitLabel}, available ${Math.max(0, availableQty)} ${required.unitLabel}.`,
      };
    }
  }

  return null;
};

const computeFactoryCosts = ({ factoryProduct, unitsCompleted, earnedAmount }) => {
  const qty = Number(unitsCompleted || 0);
  const materialCost = (factoryProduct?.standardMaterialLines || []).reduce((sum, line) => {
    return sum + (Number(line?.qtyPerUnit || 0) * qty * Number(line?.rate || 0));
  }, 0);
  const otherCost = Number(factoryProduct?.standardOtherCost || 0) * qty;
  const workerCost = Number(earnedAmount || 0);
  const actualBatchCost = materialCost + workerCost + otherCost;
  const actualCostPerUnit = qty > 0 ? actualBatchCost / qty : 0;
  return {
    materialCost,
    otherCost,
    workerCost,
    actualBatchCost,
    actualCostPerUnit,
  };
};

exports.createDailyWork = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const entryDate = normalizeDate(req.body?.entryDate);
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    const staffId = `${req.body?.staff || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({ success: false, message: "Valid staff is required" });
    }

    const staff = await Staff.findOne({
      _id: staffId,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    const attendanceStatus = `${req.body?.attendanceStatus || "PRESENT"}`.trim().toUpperCase();
    if (!["PRESENT", "HALF_DAY", "ABSENT"].includes(attendanceStatus)) {
      return res.status(400).json({ success: false, message: "Invalid attendance status" });
    }

    const unitsCompleted = Number(req.body?.unitsCompleted || 0);
    if (!Number.isFinite(unitsCompleted) || unitsCompleted < 0) {
      return res.status(400).json({ success: false, message: "Units completed must be 0 or greater" });
    }

    const factoryProduct = await resolveFactoryProduct(req, req.body?.factoryProduct);
    if (factoryProduct?.error) {
      return res.status(factoryProduct.error.status).json(factoryProduct.error);
    }

    const workItem = await resolveWorkItem(req, staff, req.body?.workItem);
    if (workItem?.error) {
      return res.status(workItem.error.status).json(workItem.error);
    }
    if (`${staff?.rateType || ""}` === "PIECE" && !factoryProduct) {
      return res.status(400).json({ success: false, message: "Piece-rate staff requires a factory product" });
    }

    const stockError = await validateFactoryProductStock({
      req,
      factoryProduct,
      unitsCompleted,
    });
    if (stockError) {
      return res.status(stockError.status).json(stockError);
    }

    const dailyWork = await StaffDailyWork.create({
      shop: req.shopId,
      staff: staff._id,
      entryDate,
      attendanceStatus,
      workType: `${req.body?.workType || staff.workType || ""}`.trim(),
      factoryProduct: factoryProduct?._id || null,
      factoryProductName: `${factoryProduct?.name || ""}`.trim(),
      workItem: workItem?._id || null,
      workItemName: `${workItem?.itemName || ""}`.trim(),
      unit: `${factoryProduct?.unitLabel || workItem?.unit || "PCS"}`.trim(),
      pieceRate: Number(factoryProduct?.workerPieceRate || workItem?.pieceRate || 0),
      workDetails: `${req.body?.workDetails || ""}`.trim(),
      linkedJob: `${req.body?.linkedJob || ""}`.trim(),
      unitsCompleted,
      earnedAmount: calculateEarnedAmount(
        staff,
        attendanceStatus,
        unitsCompleted,
        req.body?.earnedAmount,
        factoryProduct?.workerPieceRate ?? workItem?.pieceRate,
      ),
      verificationStatus: "PENDING",
      verifiedQty: 0,
      verificationNote: "",
      verifiedAt: null,
      verifiedBy: null,
      stockPushStatus: "NOT_PUSHED",
      pushedQty: 0,
      pushedAt: null,
      pushedBy: null,
      note: `${req.body?.note || ""}`.trim(),
      createdBy: req.user._id,
    });

    const populated = await populateDailyWorkQuery(StaffDailyWork.findById(dailyWork._id));

    return res.status(201).json({
      success: true,
      message: "Daily work entry added",
      dailyWork: populated,
    });
  } catch (error) {
    console.error("Create Staff Daily Work Error:", error);
    return res.status(500).json({ success: false, message: "Failed to create daily work entry" });
  }
};

exports.getDailyWorks = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const filter = {
      shop: req.shopId,
      isDeleted: false,
    };

    const staffIds = await resolveAccessibleStaffIds(req);
    if (staffIds && staffIds.length === 0) {
      return res.json({ success: true, dailyWorks: [] });
    }
    if (staffIds) {
      filter.staff = { $in: staffIds };
    }

    const { search, staff, attendanceStatus, verificationStatus, dateFrom, dateTo } = req.query || {};

    if (`${staff || ""}`.trim() && mongoose.Types.ObjectId.isValid(`${staff}`.trim())) {
      filter.staff = new mongoose.Types.ObjectId(`${staff}`.trim());
    }
    if (`${attendanceStatus || ""}`.trim()) {
      filter.attendanceStatus = `${attendanceStatus}`.trim().toUpperCase();
    }
    if (`${verificationStatus || ""}`.trim()) {
      filter.verificationStatus = `${verificationStatus}`.trim().toUpperCase();
    }

    const from = normalizeOptionalDate(dateFrom);
    const to = normalizeOptionalDate(dateTo);
    if (from || to) {
      filter.entryDate = {};
      if (from) filter.entryDate.$gte = startOfDay(from);
      if (to) filter.entryDate.$lte = endOfDay(to);
    }

    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      const staffMatches = await Staff.find({
        shop: req.shopId,
        isDeleted: false,
        $or: [{ name: regex }, { phone: regex }, { workType: regex }],
      }).select("_id");
      const matchedIds = staffMatches.map((row) => row._id);
      filter.$or = [
        { workType: regex },
        { factoryProductName: regex },
        { workItemName: regex },
        { workDetails: regex },
        { linkedJob: regex },
        { note: regex },
      ];
      if (matchedIds.length) {
        filter.$or.push({ staff: { $in: matchedIds } });
      }
    }

    const dailyWorks = await populateDailyWorkQuery(
      StaffDailyWork.find(filter).sort({ entryDate: -1, createdAt: -1 }),
    );

    return res.json({ success: true, dailyWorks });
  } catch (error) {
    console.error("Get Staff Daily Works Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch daily work entries" });
  }
};

exports.getFactoryPushHistory = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const filter = {
      sourceShop: req.shopId,
    };

    const { search, targetShop, dateFrom, dateTo } = req.query || {};

    if (`${targetShop || ""}`.trim() && mongoose.Types.ObjectId.isValid(`${targetShop}`.trim())) {
      filter.targetShop = new mongoose.Types.ObjectId(`${targetShop}`.trim());
    }

    const from = normalizeOptionalDate(dateFrom);
    const to = normalizeOptionalDate(dateTo);
    if (from || to) {
      filter.pushedAt = {};
      if (from) filter.pushedAt.$gte = startOfDay(from);
      if (to) filter.pushedAt.$lte = endOfDay(to);
    }

    if (`${search || ""}`.trim()) {
      const regex = new RegExp(`${search}`.trim(), "i");
      filter.$or = [
        { sku: regex },
        { note: regex },
      ];
    }

    const rows = await populatePushHistoryQuery(
      FactoryPushHistory.find(filter).sort({ pushedAt: -1, createdAt: -1 }),
    );

    return res.json({ success: true, rows });
  } catch (error) {
    console.error("Get Factory Push History Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch factory push history" });
  }
};

exports.getDailyWorkSummary = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const baseMatch = {
      shop: req.shopId,
      isDeleted: false,
    };

    const staffIds = await resolveAccessibleStaffIds(req);
    if (staffIds && staffIds.length === 0) {
      return res.json({
        success: true,
        summary: {
          totalEntries: 0,
          presentCount: 0,
          halfDayCount: 0,
          absentCount: 0,
          totalEarned: 0,
          totalUnitsCompleted: 0,
          byAttendance: [],
        },
      });
    }
    if (staffIds) {
      baseMatch.staff = { $in: staffIds };
    }

    const [totals, byAttendance] = await Promise.all([
      StaffDailyWork.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalEarned: { $sum: "$earnedAmount" },
            totalUnitsCompleted: { $sum: "$unitsCompleted" },
          },
        },
      ]),
      StaffDailyWork.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: "$attendanceStatus",
            count: { $sum: 1 },
            totalEarned: { $sum: "$earnedAmount" },
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      summary: {
        totalEntries: Number(totals?.[0]?.totalEntries || 0),
        presentCount: Number(byAttendance.find((row) => row._id === "PRESENT")?.count || 0),
        halfDayCount: Number(byAttendance.find((row) => row._id === "HALF_DAY")?.count || 0),
        absentCount: Number(byAttendance.find((row) => row._id === "ABSENT")?.count || 0),
        totalEarned: Number(totals?.[0]?.totalEarned || 0),
        totalUnitsCompleted: Number(totals?.[0]?.totalUnitsCompleted || 0),
        byAttendance,
      },
    });
  } catch (error) {
    console.error("Staff Daily Work Summary Error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch daily work summary" });
  }
};

exports.updateDailyWork = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    const dailyWork = await StaffDailyWork.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!dailyWork) {
      return res.status(404).json({ success: false, message: "Daily work entry not found" });
    }

    if (`${dailyWork.stockPushStatus || ""}` === "PUSHED" || Number(dailyWork.pushedQty || 0) > 0) {
      return res.status(400).json({ success: false, message: "Stock me push ho chuki entry ko edit nahi kar sakte" });
    }

    if (STAFF_ONLY_FILTER(req) && `${dailyWork.createdBy}` !== `${req.user._id}`) {
      return res.status(403).json({ success: false, message: "You can only update your own daily work entries" });
    }

    const staffId = `${req.body?.staff || dailyWork.staff || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({ success: false, message: "Valid staff is required" });
    }

    const staff = await Staff.findOne({
      _id: staffId,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }

    const entryDate = req.body?.entryDate ? normalizeDate(req.body.entryDate) : dailyWork.entryDate;
    if (!entryDate) {
      return res.status(400).json({ success: false, message: "Valid entry date is required" });
    }

    const attendanceStatus = `${req.body?.attendanceStatus || dailyWork.attendanceStatus || "PRESENT"}`.trim().toUpperCase();
    if (!["PRESENT", "HALF_DAY", "ABSENT"].includes(attendanceStatus)) {
      return res.status(400).json({ success: false, message: "Invalid attendance status" });
    }

    const unitsCompleted = Number(req.body?.unitsCompleted ?? dailyWork.unitsCompleted ?? 0);
    if (!Number.isFinite(unitsCompleted) || unitsCompleted < 0) {
      return res.status(400).json({ success: false, message: "Units completed must be 0 or greater" });
    }

    const factoryProduct = await resolveFactoryProduct(req, req.body?.factoryProduct ?? dailyWork.factoryProduct);
    if (factoryProduct?.error) {
      return res.status(factoryProduct.error.status).json(factoryProduct.error);
    }

    const workItem = await resolveWorkItem(req, staff, req.body?.workItem ?? dailyWork.workItem);
    if (workItem?.error) {
      return res.status(workItem.error.status).json(workItem.error);
    }
    if (`${staff?.rateType || ""}` === "PIECE" && !factoryProduct) {
      return res.status(400).json({ success: false, message: "Piece-rate staff requires a factory product" });
    }

    const stockError = await validateFactoryProductStock({
      req,
      factoryProduct,
      unitsCompleted,
      excludeDailyWorkId: dailyWork._id,
    });
    if (stockError) {
      return res.status(stockError.status).json(stockError);
    }

    dailyWork.staff = staff._id;
    dailyWork.entryDate = entryDate;
    dailyWork.attendanceStatus = attendanceStatus;
    dailyWork.workType = `${req.body?.workType || dailyWork.workType || staff.workType || ""}`.trim();
    dailyWork.factoryProduct = factoryProduct?._id || null;
    dailyWork.factoryProductName = `${factoryProduct?.name || ""}`.trim();
    dailyWork.workItem = workItem?._id || null;
    dailyWork.workItemName = `${workItem?.itemName || ""}`.trim();
    dailyWork.unit = `${factoryProduct?.unitLabel || workItem?.unit || dailyWork.unit || "PCS"}`.trim();
    dailyWork.pieceRate = Number(factoryProduct?.workerPieceRate || workItem?.pieceRate || 0);
    dailyWork.workDetails = `${req.body?.workDetails ?? dailyWork.workDetails ?? ""}`.trim();
    dailyWork.linkedJob = `${req.body?.linkedJob ?? dailyWork.linkedJob ?? ""}`.trim();
    dailyWork.unitsCompleted = unitsCompleted;
    dailyWork.earnedAmount = calculateEarnedAmount(
      staff,
      attendanceStatus,
      unitsCompleted,
      req.body?.earnedAmount ?? dailyWork.earnedAmount,
      factoryProduct?.workerPieceRate ?? workItem?.pieceRate ?? dailyWork.pieceRate,
    );
    dailyWork.verificationStatus = "PENDING";
    dailyWork.verifiedQty = 0;
    dailyWork.verificationNote = "";
    dailyWork.verifiedAt = null;
    dailyWork.verifiedBy = null;
    dailyWork.stockPushStatus = "NOT_PUSHED";
    dailyWork.pushedQty = 0;
    dailyWork.pushedAt = null;
    dailyWork.pushedBy = null;
    dailyWork.note = `${req.body?.note ?? dailyWork.note ?? ""}`.trim();
    dailyWork.updatedBy = req.user._id;

    await dailyWork.save();

    const populated = await populateDailyWorkQuery(StaffDailyWork.findById(dailyWork._id));

    return res.json({ success: true, message: "Daily work entry updated", dailyWork: populated });
  } catch (error) {
    console.error("Update Staff Daily Work Error:", error);
    return res.status(500).json({ success: false, message: "Failed to update daily work entry" });
  }
};

exports.deleteDailyWork = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to delete daily work entries" });
    }

    const dailyWork = await StaffDailyWork.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!dailyWork) {
      return res.status(404).json({ success: false, message: "Daily work entry not found" });
    }

    if (`${dailyWork.stockPushStatus || ""}` === "PUSHED" || Number(dailyWork.pushedQty || 0) > 0) {
      return res.status(400).json({ success: false, message: "Stock me push ho chuki entry ko delete nahi kar sakte" });
    }

    dailyWork.isDeleted = true;
    dailyWork.updatedBy = req.user._id;
    await dailyWork.save();

    return res.json({ success: true, message: "Daily work entry deleted" });
  } catch (error) {
    console.error("Delete Staff Daily Work Error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete daily work entry" });
  }
};

exports.pushDailyWorkToStock = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to push stock" });
    }

    const dailyWork = await StaffDailyWork.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!dailyWork) {
      return res.status(404).json({ success: false, message: "Daily work entry not found" });
    }

    if (!["APPROVED", "PARTIAL"].includes(`${dailyWork.verificationStatus || ""}`)) {
      return res.status(400).json({ success: false, message: "Approve verification first, then push to shop stock" });
    }

    if (`${dailyWork.stockPushStatus || ""}` === "PUSHED" || Number(dailyWork.pushedQty || 0) > 0) {
      return res.status(400).json({ success: false, message: "This entry is already pushed to shop stock" });
    }

    const pushQty = Number(dailyWork.verifiedQty || 0);
    if (!Number.isFinite(pushQty) || pushQty <= 0) {
      return res.status(400).json({ success: false, message: "Verified qty must be greater than 0 before pushing stock" });
    }

    const factoryProduct = await FactoryProduct.findOne({
      _id: dailyWork.factoryProduct,
      shop: req.shopId,
      isDeleted: false,
    }).select("name shopProduct shopModel shopVariation defaultSellingPrice standardMaterialLines standardOtherCost");

    if (!factoryProduct) {
      return res.status(400).json({ success: false, message: "Linked factory product not found" });
    }

    const sourceVariationId = `${factoryProduct.shopVariation || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(sourceVariationId)) {
      return res.status(400).json({ success: false, message: "Factory product me shop variation link missing hai" });
    }

    const sourceVariation = await ProductVariation.findOne({
      _id: sourceVariationId,
      shop: req.shopId,
    }).select("_id product model sku quantity costPrice sellingPrice");

    if (!sourceVariation) {
      return res.status(400).json({ success: false, message: "Mapped shop variation not found for current shop" });
    }

    const requestedTargetShopId = `${req.body?.targetShop || req.shopId || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(requestedTargetShopId)) {
      return res.status(400).json({ success: false, message: "Valid target shop is required" });
    }

    const targetShop = await Shop.findOne({
      _id: requestedTargetShopId,
      isActive: true,
    }).select("_id name shopCode");

    if (!targetShop) {
      return res.status(404).json({ success: false, message: "Target shop not found or inactive" });
    }

    let targetVariation = null;

    if (`${targetShop._id}` === `${req.shopId}`) {
      targetVariation = sourceVariation;
    } else {
      targetVariation = await ProductVariation.findOne({
        shop: targetShop._id,
        sku: sourceVariation.sku,
      }).select("_id product model sku quantity costPrice sellingPrice");
    }

    if (!targetVariation) {
      return res.status(400).json({
        success: false,
        message: `SKU ${sourceVariation.sku} target shop ${targetShop.shopCode || targetShop.name} me mapped nahi mila`,
      });
    }

    const costSnapshot = computeFactoryCosts({
      factoryProduct,
      unitsCompleted: pushQty,
      earnedAmount: Number(dailyWork.unitsCompleted || 0) > 0
        ? (Number(dailyWork.earnedAmount || 0) / Number(dailyWork.unitsCompleted || 1)) * pushQty
        : 0,
    });

    const existingQty = Number(targetVariation.quantity || 0);
    const existingCostPrice = Number(targetVariation.costPrice || 0);
    const nextQty = existingQty + pushQty;
    const nextCostPrice = nextQty > 0
      ? (((existingQty * existingCostPrice) + (pushQty * Number(costSnapshot.actualCostPerUnit || 0))) / nextQty)
      : Number(costSnapshot.actualCostPerUnit || 0);

    await applyStockTransaction({
      shop: targetShop._id,
      product: targetVariation.product,
      model: targetVariation.model,
      variation: targetVariation._id,
      sku: targetVariation.sku,
      type: "IN",
      quantity: pushQty,
      referenceType: "MANUAL",
      referenceId: dailyWork._id,
      note: `Factory verified output push to ${targetShop.shopCode || targetShop.name} - ${factoryProduct.name || dailyWork.factoryProductName || "Factory Product"}`,
      createdBy: req.user._id,
    });

    await ProductVariation.findByIdAndUpdate(targetVariation._id, {
      costPrice: Number(nextCostPrice || 0),
    });

    await Stock.findOneAndUpdate(
      { shop: targetShop._id, variation: targetVariation._id },
      { $set: { product: targetVariation.product, model: targetVariation.model, sku: targetVariation.sku } },
    );

    await FactoryPushHistory.create({
      sourceShop: req.shopId,
      targetShop: targetShop._id,
      dailyWork: dailyWork._id,
      staff: dailyWork.staff || null,
      factoryProduct: factoryProduct._id || null,
      sourceVariation: sourceVariation._id,
      targetVariation: targetVariation._id,
      product: targetVariation.product,
      model: targetVariation.model,
      sku: targetVariation.sku || sourceVariation.sku || "",
      quantity: pushQty,
      unit: `${dailyWork.unit || "PCS"}`.trim(),
      productionDate: dailyWork.entryDate || null,
      verifiedAt: dailyWork.verifiedAt || null,
      verificationStatus: `${dailyWork.verificationStatus || ""}`.trim().toUpperCase(),
      costPerUnit: Number(costSnapshot.actualCostPerUnit || 0),
      totalCost: Number(costSnapshot.actualBatchCost || 0),
      sellingPriceSnapshot: Number(targetVariation.sellingPrice || sourceVariation.sellingPrice || factoryProduct.defaultSellingPrice || 0),
      note: `Factory push from ${req.shopId} to ${targetShop.shopCode || targetShop.name}`,
      pushedAt: new Date(),
      pushedBy: req.user._id,
    });

    dailyWork.stockPushStatus = "PUSHED";
    dailyWork.pushedQty = pushQty;
    dailyWork.pushedToShop = targetShop._id;
    dailyWork.pushedToVariation = targetVariation._id;
    dailyWork.pushedAt = new Date();
    dailyWork.pushedBy = req.user._id;
    dailyWork.updatedBy = req.user._id;
    await dailyWork.save();

    const populated = await populateDailyWorkQuery(StaffDailyWork.findById(dailyWork._id));

    return res.json({
      success: true,
      message: `Approved factory output pushed to ${targetShop.shopCode || targetShop.name}`,
      dailyWork: populated,
    });
  } catch (error) {
    console.error("Push Staff Daily Work To Stock Error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to push output to shop stock" });
  }
};

exports.verifyDailyWork = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({ success: false, message: "Please select a shop first" });
    }

    if (!MANAGER_AND_ABOVE.includes(`${req.user?.role || ""}`)) {
      return res.status(403).json({ success: false, message: "You do not have permission to verify daily work entries" });
    }

    const dailyWork = await StaffDailyWork.findOne({
      _id: req.params.id,
      shop: req.shopId,
      isDeleted: false,
    });

    if (!dailyWork) {
      return res.status(404).json({ success: false, message: "Daily work entry not found" });
    }

    if (`${dailyWork.stockPushStatus || ""}` === "PUSHED" || Number(dailyWork.pushedQty || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: "Shop stock me push ho chuki entry ki verification badal nahi sakte",
      });
    }

    const status = `${req.body?.verificationStatus || ""}`.trim().toUpperCase();
    if (!["APPROVED", "PARTIAL", "REJECTED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Valid verification status is required" });
    }

    const totalQty = Number(dailyWork.unitsCompleted || 0);
    const requestedQty = Number(req.body?.verifiedQty ?? totalQty);

    if (status === "REJECTED") {
      dailyWork.verificationStatus = "REJECTED";
      dailyWork.verifiedQty = 0;
    } else if (status === "APPROVED") {
      dailyWork.verificationStatus = "APPROVED";
      dailyWork.verifiedQty = totalQty;
    } else {
      if (!Number.isFinite(requestedQty) || requestedQty <= 0 || requestedQty > totalQty) {
        return res.status(400).json({ success: false, message: "Partial approve qty must be greater than 0 and within completed qty" });
      }
      dailyWork.verificationStatus = "PARTIAL";
      dailyWork.verifiedQty = requestedQty;
    }

    dailyWork.verificationNote = `${req.body?.verificationNote || ""}`.trim();
    dailyWork.verifiedAt = new Date();
    dailyWork.verifiedBy = req.user._id;
    dailyWork.updatedBy = req.user._id;

    await dailyWork.save();

    const populated = await populateDailyWorkQuery(StaffDailyWork.findById(dailyWork._id));

    return res.json({
      success: true,
      message:
        status === "REJECTED"
          ? "Daily work rejected"
          : status === "PARTIAL"
            ? "Daily work partially approved"
            : "Daily work approved",
      dailyWork: populated,
    });
  } catch (error) {
    console.error("Verify Staff Daily Work Error:", error);
    return res.status(500).json({ success: false, message: "Failed to verify daily work entry" });
  }
};
