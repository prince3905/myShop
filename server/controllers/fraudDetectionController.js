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

// Calculate mean and standard deviation for anomaly detection
const calculateStats = (values) => {
  if (values.length === 0) return { mean: 0, stdDev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return { mean, stdDev };
};

// Calculate Z-score (how many standard deviations away from mean)
const getZScore = (value, mean, stdDev) => {
  if (stdDev === 0) return 0;
  return Math.abs((value - mean) / stdDev);
};

// Get historical data for a shop (last 30 days, excluding current period)
const getHistoricalDailySales = async (shopId, currentStart, currentEnd) => {
  const histStart = new Date(currentStart);
  histStart.setDate(histStart.getDate() - 30);
  
  const sales = await Sale.find({
    shop: shopId,
    createdAt: { $gte: histStart, $lt: currentStart },
    status: { $ne: "CANCELLED" },
  }).select("createdAt totalAmount paymentMethod paidAmount");

  // Group by day
  const dailyData = {};
  sales.forEach((sale) => {
    const day = sale.createdAt.toISOString().split('T')[0];
    if (!dailyData[day]) {
      dailyData[day] = { cash: 0, card: 0, online: 0, salesCount: 0, total: 0 };
    }
    const amount = sale.totalAmount || 0;
    dailyData[day].total += amount;
    dailyData[day].salesCount += 1;
    
    if (sale.paymentMethod === "CASH") {
      dailyData[day].cash += sale.paidAmount || amount;
    } else if (sale.paymentMethod === "CARD") {
      dailyData[day].card += sale.paidAmount || amount;
    } else if (["UPI", "ONLINE", "BANK"].includes(sale.paymentMethod)) {
      dailyData[day].online += sale.paidAmount || amount;
    }
  });

  return {
    cashValues: Object.values(dailyData).map(d => d.cash),
    salesCountValues: Object.values(dailyData).map(d => d.salesCount),
    totalValues: Object.values(dailyData).map(d => d.total),
  };
};

exports.getFraudDetectionReport = async (req, res) => {
  try {
    const { date, days = 7, shopId: queryShopId, startDate, endDate } = req.query;
    const daysBack = parseInt(days) || 7;
    
    // Use custom date range if provided, otherwise use daysBack
    let start, end;
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      const dateRange = getDateRange(date, daysBack);
      start = dateRange.start;
      end = dateRange.end;
    }

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
        riskScore: 0,
        riskLevel: "LOW",
      };

      // Get historical data for anomaly detection
      const historicalData = await getHistoricalDailySales(shop._id, start, end);
      const cashStats = calculateStats(historicalData.cashValues);
      const salesCountStats = calculateStats(historicalData.salesCountValues);
      const totalStats = calculateStats(historicalData.totalValues);

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

        const expectedCash = totalCash - cashRefunds;
        const totalCollection = totalCash + totalCard + totalOnline;

        // Anomaly detection: Is current cash unusual compared to history?
        const cashZScore = getZScore(totalCash, cashStats.mean, cashStats.stdDev);
        const isCashAnomaly = cashZScore > 2; // More than 2 std deviations

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
            anomalyCheck: {
              isAnomaly: isCashAnomaly,
              zScore: cashZScore.toFixed(2),
              historicalMean: cashStats.mean.toFixed(2),
              message: isCashAnomaly ? "⚠️ Cash collection is UNUSUAL compared to past 30 days!" : "Cash collection is within normal range.",
            },
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
              note: "Physical count was less than system stock. Staff may have stolen items!",
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

          // Anomaly: Compare with historical cancellation patterns
          const histCancelled = await Sale.find({
            shop: shop._id,
            createdAt: { $gte: new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000), $lt: start },
            status: "CANCELLED",
          }).select("totalAmount");

          const dailyCancelled = {};
          histCancelled.forEach((s) => {
            const day = s.createdAt.toISOString().split('T')[0];
            dailyCancelled[day] = (dailyCancelled[day] || 0) + (s.totalAmount || 0);
          });
          const cancelledValues = Object.values(dailyCancelled);
          const cancelledStats = calculateStats(cancelledValues);
          const cancelledZScore = getZScore(totalCancelledAmount, cancelledStats.mean, cancelledStats.stdDev);

          shopReport.alerts.push({
            type: "VOIDED_TRANSACTIONS",
            severity: totalCancelledAmount > 5000 || cancelledZScore > 2 ? "HIGH" : "MEDIUM",
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
              anomalyCheck: {
                isAnomaly: cancelledZScore > 2,
                zScore: cancelledZScore.toFixed(2),
                historicalMean: cancelledStats.mean.toFixed(2),
                message: cancelledZScore > 2 ? "⚠️ Unusually high cancellations compared to history!" : "Cancellation rate is within normal range.",
              },
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

      // ==================== 6. ANOMALY DETECTION (AI-like Statistical) ====================
      try {
        // Check if sales volume is anomalous
        const currentSalesCount = await Sale.countDocuments({
          shop: shop._id,
          createdAt: { $gte: start, $lte: end },
          status: { $ne: "CANCELLED" },
        });

        const salesCountZScore = getZScore(currentSalesCount, salesCountStats.mean, salesCountStats.stdDev);
        const totalSalesZScore = getZScore(
          shopReport.alerts.find(a => a.type === 'CASH_MISMATCH')?.data?.totalSales || 0,
          totalStats.mean,
          totalStats.stdDev
        );

        const anomalies = [];
        if (salesCountZScore > 2) {
          anomalies.push({
            metric: "Sales Count",
            current: currentSalesCount,
            historicalMean: salesCountStats.mean.toFixed(0),
            zScore: salesCountZScore.toFixed(2),
            message: currentSalesCount > salesCountStats.mean ? "Unusually HIGH sales activity" : "Unusually LOW sales activity - possible under-reporting",
          });
        }
        if (totalSalesZScore > 2) {
          anomalies.push({
            metric: "Total Sales Amount",
            current: shopReport.alerts.find(a => a.type === 'CASH_MISMATCH')?.data?.totalSales || 0,
            historicalMean: totalStats.mean.toFixed(0),
            zScore: totalSalesZScore.toFixed(2),
            message: "Sales amount is far from historical average - possible manipulation",
          });
        }

        if (anomalies.length > 0) {
          shopReport.alerts.push({
            type: "ANOMALY_DETECTED",
            severity: "HIGH",
            title: "🤖 AI Anomaly Detection Alert",
            description: `${anomalies.length} unusual pattern(s) detected compared to past 30 days`,
            data: {
              anomalies,
              note: "These patterns are statistically unusual. HIGH chance of staff manipulation or theft!",
            },
          });
        }
      } catch (err) {
        console.error("Anomaly detection error:", err.message);
      }

      // ==================== 7. RISK SCORING ====================
      let riskScore = 0;
      const riskFactors = [];

      shopReport.alerts.forEach((alert) => {
        if (alert.type === "CASH_MISMATCH") {
          if (alert.data?.anomalyCheck?.isAnomaly) {
            riskScore += 30;
            riskFactors.push("Unusual cash patterns detected");
          }
          if (Math.abs((alert.data?.expectedCash || 0) - (alert.data?.totalCash || 0)) > 500) {
            riskScore += 25;
            riskFactors.push("Large cash mismatch");
          }
        }
        if (alert.type === "SUSPICIOUS_RETURNS") {
          riskScore += 20;
          riskFactors.push("Suspicious customer return patterns");
        }
        if (alert.type === "STOCK_DISCREPANCY") {
          riskScore += 35;
          riskFactors.push("Stock missing - possible theft");
        }
        if (alert.type === "VOIDED_TRANSACTIONS") {
          riskScore += 25;
          if (alert.data?.anomalyCheck?.isAnomaly) {
            riskScore += 15;
            riskFactors.push("Unusual cancellation patterns");
          }
        }
        if (alert.type === "DISCOUNT_ABUSE") {
          riskScore += 15;
          riskFactors.push("Unauthorized discount giving");
        }
        if (alert.type === "ANOMALY_DETECTED") {
          riskScore += 30;
          riskFactors.push("Statistical anomaly detected");
        }
      });

      shopReport.riskScore = Math.min(riskScore, 100);
      shopReport.riskLevel = shopReport.riskScore >= 70 ? "HIGH" : shopReport.riskScore >= 40 ? "MEDIUM" : "LOW";
      shopReport.riskFactors = riskFactors;

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
