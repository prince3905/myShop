const mongoose = require("mongoose");
const Sale = require("../models/CustomerSale");
const SaleReturn = require("../models/SaleReturn");
const StockReconciliation = require("../models/StockReconciliation");
const Shop = require("../models/Shop");

const getDateRange = (date, daysBack = 7) => {
  const end = date ? new Date(date) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

exports.getFraudDetectionReport = async (req, res) => {
  try {
    const { date, days = 7 } = req.query;
    const daysBack = parseInt(days) || 7;
    const { start, end } = getDateRange(date, daysBack);

    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const isSuperAdmin = req.user.role === "SUPER_ADMIN";

    let shops = [];
    if (isSuperAdmin && req.query.shopId) {
      const shop = await Shop.findById(req.query.shopId).select("_id name shopCode");
      if (shop) shops = [shop];
    } else if (isSuperAdmin && !req.query.shopId) {
      shops = await Shop.find({ isActive: true }).select("_id name shopCode");
    } else {
      if (!req.shopId) {
        return res.status(400).json({ success: false, message: "Shop not found" });
      }
      const shop = await Shop.findById(req.shopId).select("_id name shopCode");
      if (!shop) {
        return res.status(404).json({ success: false, message: "Shop not found" });
      }
      shops = [shop];
    }

    const report = {
      generatedAt: new Date(),
      period: { start, end, daysBack },
      shops: [],
    };

    for (const shop of shops) {
      const shopReport = {
        shop: { id: shop._id, name: shop.name, code: shop.shopCode },
        alerts: [],
      };

      try {
        // Get all sales in period
        const sales = await Sale.find({
          shop: shop._id,
          createdAt: { $gte: start, $lte: end },
          status: { $ne: "CANCELLED" },
        }).select("paymentMethod paymentBreakdown totalAmount paidAmount");

        let totalSales = 0;
        let totalCash = 0;
        let totalCard = 0;
        let totalOnline = 0;

        sales.forEach((sale) => {
          const amount = sale.totalAmount || 0;
          totalSales += amount;
          
          if (sale.paymentMethod === "CASH") {
            totalCash += sale.paidAmount || amount;
          } else if (sale.paymentMethod === "CARD") {
            totalCard += sale.paidAmount || amount;
          } else if (["UPI", "ONLINE", "BANK"].includes(sale.paymentMethod)) {
            totalOnline += sale.paidAmount || amount;
          } else if (sale.paymentMethod === "SPLIT" && sale.paymentBreakdown && sale.paymentBreakdown.length > 0) {
            sale.paymentBreakdown.forEach((p) => {
              const pAmount = p.amount || 0;
              if (p.method === "CASH") totalCash += pAmount;
              else if (p.method === "CARD") totalCard += pAmount;
              else if (["UPI", "ONLINE", "BANK"].includes(p.method)) totalOnline += pAmount;
            });
          }
        });

        // Get cash refunds
        const returns = await SaleReturn.find({
          shop: shop._id,
          createdAt: { $gte: start, $lte: end },
        }).select("paymentMethod refundAmount");

        let cashRefunds = 0;
        let totalRefunds = 0;
        returns.forEach((ret) => {
          totalRefunds += ret.refundAmount || 0;
          if (ret.paymentMethod === "CASH") {
            cashRefunds += ret.refundAmount || 0;
          }
        });

        const expectedCash = totalCash - cashRefunds;
        const totalCollection = totalCash + totalCard + totalOnline;

        shopReport.alerts.push({
          type: "CASH_MISMATCH",
          severity: Math.abs(expectedCash - totalCash) > 500 || cashRefunds > 500 ? "HIGH" : "MEDIUM",
          title: "Cash Summary",
          description: `Total Sales: ₹${totalSales} | Cash: ₹${totalCash} | Card: ₹${totalCard} | Online: ₹${totalOnline}`,
          data: {
            totalSales,
            totalCash,
            totalCard,
            totalOnline,
            totalCollection,
            cashRefunds,
            totalRefunds,
            expectedCash,
            transactionCount: sales.length,
            mismatch: expectedCash - totalCash,
          },
        });
      } catch (err) {
        console.error("Cash detection error:", err.message, err.stack);
      }

      try {
        const returns = await SaleReturn.find({
          shop: shop._id,
          createdAt: { $gte: start, $lte: end },
        }).populate("customer", "name phone");

        const custMap = {};
        returns.forEach((ret) => {
          const custId = ret.customer?._id?.toString();
          if (!custId) return;
          custMap[custId] = (custMap[custId] || 0) + 1;
        });

        const suspicious = Object.entries(custMap)
          .filter(([_, count]) => count >= 3)
          .map(([id]) => returns.find((r) => r.customer?._id?.toString() === id)?.customer);

        if (suspicious.length > 0) {
          shopReport.alerts.push({
            type: "SUSPICIOUS_RETURNS",
            severity: "HIGH",
            title: "Suspicious Returns",
            description: `${suspicious.length} customers with 3+ returns`,
            data: { customers: suspicious },
          });
        }
      } catch (err) {
        console.error("Returns detection error:", err.message);
      }

      shopReport.summary = {
        totalAlerts: shopReport.alerts.length,
        highSeverity: shopReport.alerts.filter((a) => a.severity === "HIGH").length,
        mediumSeverity: shopReport.alerts.filter((a) => a.severity === "MEDIUM").length,
        lowSeverity: shopReport.alerts.filter((a) => a.severity === "LOW").length,
      };

      report.shops.push(shopReport);
    }

    report.globalSummary = {
      totalShops: shops.length,
      totalAlerts: report.shops.reduce((sum, s) => sum + s.summary.totalAlerts, 0),
      highSeverityAlerts: report.shops.reduce((sum, s) => sum + s.summary.highSeverity, 0),
    };

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    console.error("Fraud Detection Error:", error.message, error.stack);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};
