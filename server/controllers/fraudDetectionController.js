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
    const { date, days = 7, shopId: queryShopId } = req.query;
    const daysBack = parseInt(days) || 7;
    const { start, end } = getDateRange(date, daysBack);

    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const isSuperAdmin = req.user.role === "SUPER_ADMIN";

    let shops = [];
    if (isSuperAdmin && queryShopId) {
      const shop = await Shop.findById(queryShopId).select("_id name shopCode");
      if (shop) shops = [shop];
    } else if (isSuperAdmin && !queryShopId) {
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

      // ==================== 1. CASH MISMATCH DETECTION ====================
      try {
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

        const returns = await SaleReturn.find({
          shop: shop._id,
          createdAt: { $gte: start, $lte: end },
        }).select("refundMethod refundAmount");

        let cashRefunds = 0;
        let totalRefunds = 0;
        returns.forEach((ret) => {
          const refund = ret.refundAmount || 0;
          totalRefunds += refund;
          if (ret.refundMethod === "CASH") {
            cashRefunds += refund;
          }
        });

        // Expected cash = cash from sales minus cash refunds given back
        const expectedCash = totalCash - cashRefunds;
        const totalCollection = totalCash + totalCard + totalOnline;

        shopReport.alerts.push({
          type: "CASH_MISMATCH",
          severity: Math.abs(expectedCash - totalCash) > 500 || cashRefunds > 500 ? "HIGH" : "MEDIUM",
          title: "Cash Summary",
          description: `Total Sales: ₹${totalSales} | Cash: ₹${totalCash} | Card: ₹${totalCard} | Online: ₹${totalOnline} | Cash Refunds: ₹${cashRefunds}`,
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
            note: "Expected cash in register = Cash Sales - Cash Refunds. Please count physical cash and compare.",
          },
        });
      } catch (err) {
        console.error("Cash detection error:", err.message, err.stack);
      }

      // ==================== 2. SUSPICIOUS RETURNS ====================
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
          .map(([id]) => {
            const r = returns.find((r) => r.customer?._id?.toString() === id);
            return {
              customer: r.customer,
              returnCount: custMap[id],
            };
          });

        if (suspicious.length > 0) {
          shopReport.alerts.push({
            type: "SUSPICIOUS_RETURNS",
            severity: "HIGH",
            title: "Suspicious Return Patterns",
            description: `${suspicious.length} customer(s) with 3+ returns in this period`,
            data: { customers: suspicious },
          });
        }
      } catch (err) {
        console.error("Returns detection error:", err.message);
      }

      // ==================== 3. STOCK DISCREPANCY (Theft Detection) ====================
      try {
        const reconciliations = await StockReconciliation.find({
          shop: shop._id,
          createdAt: { $gte: start, $lte: end },
          status: { $in: ["SUBMITTED", "APPROVED"] },
        }).populate("lines.variation lines.product lines.model");

        const discrepancies = [];
        let totalMissingQty = 0;

        reconciliations.forEach((rec) => {
          rec.lines.forEach((line) => {
            // varianceQty = countedQty - systemQty (negative means missing stock)
            if (line.varianceQty < 0) {
              discrepancies.push({
                productName: line.productName || "Unknown",
                modelName: line.modelName || "",
                sku: line.sku,
                systemQty: line.systemQty,
                countedQty: line.countedQty,
                missingQty: Math.abs(line.varianceQty),
                note: line.note || "",
              });
              totalMissingQty += Math.abs(line.varianceQty);
            }
          });
        });

        if (discrepancies.length > 0) {
          shopReport.alerts.push({
            type: "STOCK_DISCREPANCY",
            severity: totalMissingQty > 10 ? "HIGH" : "MEDIUM",
            title: "Stock Missing - Possible Theft",
            description: `${discrepancies.length} item(s) have less stock than system shows. Total missing: ${totalMissingQty} units.`,
            data: {
              discrepancies,
              totalMissingItems: discrepancies.length,
              totalMissingQty,
              note: "Physical count was less than system stock. Investigate if items were stolen or not properly recorded.",
            },
          });
        }
      } catch (err) {
        console.error("Stock discrepancy error:", err.message);
      }

      // ==================== 4. VOIDED/CANCELLED TRANSACTIONS ====================
      try {
        const cancelledSales = await Sale.find({
          shop: shop._id,
          createdAt: { $gte: start, $lte: end },
          status: "CANCELLED",
        }).select("invoiceNo totalAmount createdAt");

        if (cancelledSales.length > 0) {
          const totalCancelledAmount = cancelledSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

          shopReport.alerts.push({
            type: "VOIDED_TRANSACTIONS",
            severity: totalCancelledAmount > 5000 ? "HIGH" : "MEDIUM",
            title: "Cancelled Bills Alert",
            description: `${cancelledSales.length} bills were cancelled, total value: ₹${totalCancelledAmount}`,
            data: {
              cancelledSales: cancelledSales.map((s) => ({
                invoiceNo: s.invoiceNo,
                amount: s.totalAmount,
                date: s.createdAt,
              })),
              totalCancelledAmount,
              note: "Staff may take cash and then cancel the bill. Verify these cancellations.",
            },
          });
        }
      } catch (err) {
        console.error("Voided transactions error:", err.message);
      }

      // ==================== 5. DISCOUNT ABUSE DETECTION ====================
      try {
        const salesWithDiscounts = await Sale.find({
          shop: shop._id,
          createdAt: { $gte: start, $lte: end },
          status: { $ne: "CANCELLED" },
          $or: [
            { billDiscount: { $gt: 500 } },
            { "items.discount": { $gt: 200 } },
          ],
        }).select("invoiceNo totalAmount billDiscount items createdAt");

        const suspiciousDiscounts = salesWithDiscounts.map((sale) => {
          const itemDiscounts = sale.items
            .filter((item) => (item.discount || 0) > 200)
            .map((item) => ({
              item: item.itemName || item.item,
              discount: item.discount,
              discountType: item.discountType,
            }));

          return {
            invoiceNo: sale.invoiceNo,
            totalAmount: sale.totalAmount,
            billDiscount: sale.billDiscount || 0,
            date: sale.createdAt,
            highItemDiscounts: itemDiscounts,
          };
        });

        if (suspiciousDiscounts.length > 0) {
          const totalDiscountAmount = suspiciousDiscounts.reduce(
            (sum, s) => sum + s.billDiscount + s.highItemDiscounts.reduce((isum, i) => isum + i.discount, 0),
            0
          );

          shopReport.alerts.push({
            type: "DISCOUNT_ABUSE",
            severity: totalDiscountAmount > 2000 ? "HIGH" : "MEDIUM",
            title: "Unusual Discount Patterns",
            description: `${suspiciousDiscounts.length} sales with high discounts. Total discounted: ₹${totalDiscountAmount}`,
            data: {
              sales: suspiciousDiscounts,
              totalDiscountAmount,
              note: "Large discounts may indicate staff giving unauthorized discounts to friends/family.",
            },
          });
        }
      } catch (err) {
        console.error("Discount abuse error:", err.message);
      }

      // Summary
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
