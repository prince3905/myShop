const Product = require("../models/Product");
const slugify = require("slugify");
const ProductVariation = require("../models/ProductVariation");
const ProductModel = require("../models/ProductModel");
const Stock = require("../models/Stock");
const Sale = require("../models/CustomerSale");
const Order = require("../models/order");
const Purchase = require("../models/Purchase");
const StockTransaction = require("../models/StockTransaction");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const { logEntityAudit } = require("../utils/entityAudit.service");

const isSuperAdminGlobal = (req) =>
  req.user?.role === "SUPER_ADMIN" && !req.shopId;

const canViewSensitivePricing = (req) =>
  ["SUPER_ADMIN", "ADMIN"].includes(`${req.user?.role || ""}`);

const sanitizeVariationPricing = (variation, req) => {
  if (!variation || canViewSensitivePricing(req)) {
    return variation;
  }

  const plainVariation = variation.toObject?.() || { ...variation };
  delete plainVariation.costPrice;
  return plainVariation;
};

const sanitizeProductPricing = (product, req) => {
  if (!product || canViewSensitivePricing(req)) {
    return product;
  }

  const plainProduct = product.toObject?.() || { ...product };
  plainProduct.variations = Array.isArray(plainProduct.variations)
    ? plainProduct.variations.map((variation) => sanitizeVariationPricing(variation, req))
    : [];
  return plainProduct;
};

const groupVariationsByModel = (variations = [], req = null) => {
  const grouped = new Map();

  for (const variation of variations) {
    const modelId = `${variation?.model?._id || variation?.model || ""}`.trim();
    const modelName = `${variation?.model?.name || variation?.modelName || ""}`.trim();
    const key = modelId || modelName || `${variation?._id || ""}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        _id: variation?.model?._id || variation?.model || undefined,
        modelId: variation?.model?._id || variation?.model || undefined,
        model: modelName,
        name: modelName,
        variations: [],
      });
    }

    const variationDoc = variation.toObject?.() || { ...variation };
    if (req && !canViewSensitivePricing(req)) {
      delete variationDoc.costPrice;
    }

    grouped.get(key).variations.push({
      ...variationDoc,
      orderNumber: variation?.sku || variation?.orderNumber || "",
      size: variation?.attributes?.size || variation?.size || "",
      color: variation?.attributes?.color || variation?.color || "",
    });
  }

  return Array.from(grouped.values());
};

const mapProductForPosSearch = (productDoc, matchedBy = [], req = null) => ({
  productId: productDoc?._id,
  name: productDoc?.name || "",
  label: productDoc?.name || "",
  matchedBy,
  models: groupVariationsByModel(Array.isArray(productDoc?.variations) ? productDoc.variations : [], req),
});

const validateCategoryBrandMapping = async ({ shopId, categoryId, brandId }) => {
  if (!shopId || !categoryId || !brandId) {
    return { valid: false, message: "Category and brand are required" };
  }

  const [category, brand] = await Promise.all([
    Category.findOne({ _id: categoryId, shop: shopId }).select("_id name brands").lean(),
    Brand.findOne({ _id: brandId, shop: shopId }).select("_id name").lean(),
  ]);

  if (!category) {
    return { valid: false, message: "Selected category not found for this shop" };
  }

  if (!brand) {
    return { valid: false, message: "Selected brand not found for this shop" };
  }

  const mappedBrandIds = Array.isArray(category.brands)
    ? category.brands.map((row) => `${row}`)
    : [];

  if (mappedBrandIds.length && !mappedBrandIds.includes(`${brand._id}`)) {
    return {
      valid: false,
      message: `Brand "${brand.name}" is not mapped to category "${category.name}"`,
    };
  }

  return { valid: true, category, brand };
};

const getProductUsageSummary = async ({ productId, shopId, variationIds = [] }) => {
  const hasVariationIds = Array.isArray(variationIds) && variationIds.length > 0;
  const variationClause = hasVariationIds
    ? { "items.variationId": { $in: variationIds } }
    : null;
  const purchaseVariationClause = hasVariationIds
    ? { "items.variation": { $in: variationIds } }
    : null;

  const saleQuery = {
    shop: shopId,
    $or: [{ "items.item": productId }, ...(variationClause ? [variationClause] : [])],
  };
  const orderQuery = {
    shop: shopId,
    $or: [{ "items.item": productId }, ...(variationClause ? [variationClause] : [])],
  };
  const purchaseQuery = {
    shop: shopId,
    $or: [
      { "items.product": productId },
      ...(purchaseVariationClause ? [purchaseVariationClause] : []),
    ],
  };
  const stockTxQuery = {
    shop: shopId,
    $or: [{ product: productId }, ...(hasVariationIds ? [{ variation: { $in: variationIds } }] : [])],
  };

  const [saleCount, orderCount, purchaseCount, stockTxCount] = await Promise.all([
    Sale.countDocuments(saleQuery),
    Order.countDocuments(orderQuery),
    Purchase.countDocuments(purchaseQuery),
    StockTransaction.countDocuments(stockTxQuery),
  ]);

  return {
    saleCount: Number(saleCount || 0),
    orderCount: Number(orderCount || 0),
    purchaseCount: Number(purchaseCount || 0),
    stockTxCount: Number(stockTxCount || 0),
  };
};

/* =========================
   CREATE PRODUCT
========================= */
exports.createProduct = async (req, res) => {
  try {
    const { name, category, brand, description, images } = req.body;

    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const mappingCheck = await validateCategoryBrandMapping({
      shopId: req.shopId,
      categoryId: category,
      brandId: brand,
    });

    if (!mappingCheck.valid) {
      return res.status(400).json({
        success: false,
        message: mappingCheck.message,
      });
    }

    const slug = slugify(name, { lower: true, strict: true });

    const product = await Product.create({
      name,
      slug,
      category,
      brand,
      description,
      images,
      shop: req.shopId,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
    await logEntityAudit({
      shop: req.shopId,
      entityType: "PRODUCT",
      entityId: product._id,
      action: "CREATE",
      actor: req.user?._id,
      meta: { name: product.name },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Product already exists for this shop",
      });
    }

    res.status(500).json({
      success: false,
      message: "Error creating product",
      error: error.message,
    });
  }
};

/* =========================
   GET ALL PRODUCTS (SHOP WISE)
========================= */
exports.getProducts = async (req, res) => {
  try {
    const { limit, skip, sort = "-createdAt", search } = req.query;
    const query = isSuperAdminGlobal(req)
      ? { isDeleted: { $ne: true } }
      : { shop: req.shopId, isDeleted: { $ne: true } };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    let productQuery = Product.find(query)
      .sort(sort)
      .populate("brand", "name")
      .populate("category", "name")
      .populate({
        path: "variations",
        populate: {
          path: "model",
          select: "name",
        },
      });

    if (limit) {
      productQuery = productQuery.limit(Number(limit) || 0);
    }

    if (skip) {
      productQuery = productQuery.skip(Number(skip) || 0);
    }

    const products = await productQuery;
    const safeProducts = products.map((product) => sanitizeProductPricing(product, req));

    res.json({
      success: true,
      count: safeProducts.length,
      data: safeProducts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching products",
    });
  }
};

exports.searchProductsForPos = async (req, res) => {
  try {
    const term = `${req.query.term || ""}`.trim();
    if (!term) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const regex = new RegExp(term, "i");
    const productFilter = isSuperAdminGlobal(req)
      ? { isDeleted: { $ne: true } }
      : { shop: req.shopId, isDeleted: { $ne: true } };
    const shopScopedFilter = isSuperAdminGlobal(req) ? {} : { shop: req.shopId };

    const [productMatches, modelMatches, variationMatches] = await Promise.all([
      Product.find({
        ...productFilter,
        name: { $regex: regex },
      }).select("_id name").limit(12),
      ProductModel.find({
        ...shopScopedFilter,
        name: { $regex: regex },
      }).select("_id product name").limit(12),
      ProductVariation.find({
        ...shopScopedFilter,
        $or: [{ sku: { $regex: regex } }, { barcode: { $regex: regex } }],
      })
        .select("_id product model sku barcode")
        .populate("model", "name")
        .limit(12),
    ]);

    const matchMeta = new Map();
    const addMatch = (productId, label) => {
      const key = `${productId || ""}`;
      if (!key) return;
      if (!matchMeta.has(key)) {
        matchMeta.set(key, new Set());
      }
      matchMeta.get(key).add(label);
    };

    productMatches.forEach((row) => addMatch(row._id, "Name"));
    modelMatches.forEach((row) => addMatch(row.product, `Model: ${row.name}`));
    variationMatches.forEach((row) => {
      addMatch(row.product, `SKU: ${row.sku}`);
      if (row.barcode && regex.test(row.barcode)) {
        addMatch(row.product, `Barcode: ${row.barcode}`);
      }
      if (row.model?.name && regex.test(row.model.name)) {
        addMatch(row.product, `Model: ${row.model.name}`);
      }
    });

    const productIds = Array.from(matchMeta.keys()).slice(0, 20);
    if (!productIds.length) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const products = await Product.find({
      ...productFilter,
      _id: { $in: productIds },
    })
      .populate({
        path: "variations",
        populate: {
          path: "model",
          select: "name",
        },
      })
      .select("_id name variations");

    const orderMap = new Map(productIds.map((id, index) => [String(id), index]));
    const rows = products
      .sort((a, b) => (orderMap.get(String(a._id)) ?? 999) - (orderMap.get(String(b._id)) ?? 999))
      .map((product) => mapProductForPosSearch(product, Array.from(matchMeta.get(String(product._id)) || []), req));

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error searching products for POS",
      error: error.message,
    });
  }
};

/* =========================
   GET SINGLE PRODUCT
========================= */
exports.getProductById = async (req, res) => {
  try {
    const filter = isSuperAdminGlobal(req)
      ? { _id: req.params.id, isDeleted: { $ne: true } }
      : { _id: req.params.id, shop: req.shopId, isDeleted: { $ne: true } };

    const product = await Product.findOne(filter)
      .populate("category", "name")
      .populate("brand", "name")
      .populate({
        path: "variations",
        populate: {
          path: "model",
          select: "name",
        },
      });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      data: sanitizeProductPricing(product, req),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching product",
    });
  }
};

/* =========================
   UPDATE PRODUCT
========================= */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const allowedFields = ["name", "category", "brand", "description", "images", "isActive"];
    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    if (updateData.name) {
      updateData.slug = slugify(updateData.name, { lower: true, strict: true });
    }

    if (updateData.category !== undefined || updateData.brand !== undefined) {
      const existingProduct = await Product.findOne({
        _id: id,
        shop: req.shopId,
        isDeleted: { $ne: true },
      }).select("category brand");

      if (!existingProduct) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const nextCategory = updateData.category !== undefined ? updateData.category : existingProduct.category;
      const nextBrand = updateData.brand !== undefined ? updateData.brand : existingProduct.brand;

      const mappingCheck = await validateCategoryBrandMapping({
        shopId: req.shopId,
        categoryId: nextCategory,
        brandId: nextBrand,
      });

      if (!mappingCheck.valid) {
        return res.status(400).json({
          success: false,
          message: mappingCheck.message,
        });
      }
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, shop: req.shopId, isDeleted: { $ne: true } },
      updateData,
      {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
    await logEntityAudit({
      shop: req.shopId,
      entityType: "PRODUCT",
      entityId: product._id,
      action: "UPDATE",
      actor: req.user?._id,
      meta: { updatedFields: Object.keys(updateData) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating product",
    });
  }
};

/* =========================
   DELETE PRODUCT
========================= */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const product = await Product.findOne({
      _id: id,
      shop: req.shopId,
      isDeleted: { $ne: true },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const [variationDocs, modelDocs] = await Promise.all([
      ProductVariation.find({ product: id, shop: req.shopId }).select("_id"),
      ProductModel.find({ product: id, shop: req.shopId }).select("_id"),
    ]);
    const variationIds = variationDocs.map((v) => v._id);
    const modelIds = modelDocs.map((m) => m._id);

    const usage = await getProductUsageSummary({
      productId: product._id,
      shopId: req.shopId,
      variationIds,
    });
    const hasUsage =
      usage.saleCount > 0 ||
      usage.orderCount > 0 ||
      usage.purchaseCount > 0;

    if (hasUsage) {
      return res.status(409).json({
        success: false,
        message:
          "Cannot delete this product because transactions exist. Deactivate it instead.",
        usage,
      });
    }

    await Product.findOneAndUpdate(
      { _id: id, shop: req.shopId },
      {
        isDeleted: true,
        isActive: false,
        archivedAt: new Date(),
        archivedBy: req.user?._id,
      },
      { new: true },
    );
    await ProductVariation.updateMany(
      { product: id, shop: req.shopId },
      { isActive: false },
    );
    await ProductModel.updateMany(
      { product: id, shop: req.shopId },
      { isActive: false },
    );
    await logEntityAudit({
      shop: req.shopId,
      entityType: "PRODUCT",
      entityId: id,
      action: "ARCHIVE",
      actor: req.user?._id,
      meta: { name: product.name },
    });

    res.status(200).json({
      success: true,
      message: "Product archived successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting product",
    });
  }
};

exports.restoreProduct = async (req, res) => {
  try {
    if (!req.shopId) {
      return res.status(400).json({
        success: false,
        message: "Please select a shop first",
      });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, shop: req.shopId, isDeleted: true },
      {
        isDeleted: false,
        isActive: true,
        archivedAt: null,
        archivedBy: null,
      },
      { new: true },
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Archived product not found",
      });
    }

    await logEntityAudit({
      shop: req.shopId,
      entityType: "PRODUCT",
      entityId: product._id,
      action: "RESTORE",
      actor: req.user?._id,
      meta: { name: product.name },
    });

    return res.status(200).json({
      success: true,
      message: "Product restored successfully",
      data: product,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error restoring product",
      error: error.message,
    });
  }
};
